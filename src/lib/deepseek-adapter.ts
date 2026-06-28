/**
 * Multi-backend AI Adapter
 *
 * Drop-in replacement for z-ai-web-dev-sdk's ZAI interface.
 * Routes calls to the most appropriate backend based on available env vars.
 *
 * Backend selection priority:
 *   - chat.completions.create  → DeepSeek (required)
 *   - chat.completions.createVision → ZHIPU GLM-4V > OpenAI GPT-4V
 *   - images.generations.create → ZHIPU CogView > OpenAI DALL-E
 *   - audio.tts.create → ZHIPU CogTTS > OpenAI TTS
 *   - audio.asr.create → OpenAI Whisper
 *   - functions.invoke('web_search') → DuckDuckGo HTML (no key) > ZHIPU web_search
 *
 * Required env:
 *   DEEPSEEK_API_KEY — for chat (mandatory)
 *
 * Optional env (enable advanced features):
 *   ZHIPU_API_KEY    — vision, image gen, TTS, web search
 *   OPENAI_API_KEY   — vision, image gen, TTS, ASR
 */

/**
 * Multi-backend AI Adapter
 *
 * Routes calls to the most appropriate backend based on available env vars.
 *
 * Chat backend priority:
 *   1. ZHIPU GLM-4-Flash (FREE, always available if ZHIPU_API_KEY is set)
 *   2. DeepSeek (paid, used as fallback)
 *   3. OpenAI (paid, last resort)
 *
 * This ensures chat always works even when DeepSeek runs out of balance.
 */
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/** Determine which chat backend to use based on available keys + model preference.
 *
 * Priority: ZHIPU (free) → DeepSeek → OpenAI
 * Reasoner models always go to DeepSeek (ZHIPU doesn't have a reasoner).
 */
function getChatBackend(model?: string): { backend: 'zhipu' | 'deepseek' | 'openai'; model: string } {
  const zhipuKey = process.env.ZHIPU_API_KEY?.trim();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  const m = (model || '').toLowerCase();

  // Reasoner models → DeepSeek only (ZHIPU doesn't have reasoning)
  if (m.includes('reasoner') || m.includes('r1') || m.includes('o1') || m.includes('reasoning')) {
    if (deepseekKey) return { backend: 'deepseek', model: 'deepseek-reasoner' };
  }

  // Default: prefer ZHIPU GLM-4-Flash (FREE)
  if (zhipuKey) {
    return { backend: 'zhipu', model: 'glm-4-flash' };
  }

  // Fallback to DeepSeek
  if (deepseekKey) {
    return { backend: 'deepseek', model: 'deepseek-chat' };
  }

  // Last resort: OpenAI
  if (openaiKey) {
    return { backend: 'openai', model: 'gpt-4o-mini' };
  }

  return { backend: 'zhipu', model: 'glm-4-flash' };
}

/** Legacy function kept for backwards compatibility. */
function mapChatModel(model?: string): string {
  return getChatBackend(model).model;
}

/** Map any vision model id to a ZHIPU or OpenAI vision model. */
function mapVisionModel(model?: string, preferZhipu = true): string {
  if (preferZhipu) return 'glm-4v-plus';
  if (!model) return 'gpt-4o';
  const m = model.toLowerCase();
  if (m.includes('claude')) return 'gpt-4o'; // OpenAI fallback
  return 'gpt-4o';
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  thinking?: { type: string };
  [key: string]: unknown;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

interface ImageGenRequest {
  prompt: string;
  size?: string;
  n?: number;
  [key: string]: unknown;
}

interface ImageGenResponse {
  data: Array<{ base64: string; url?: string }>;
}

interface TTSRequest {
  input: string;
  voice?: string;
  speed?: number;
  response_format?: string;
  stream?: boolean;
  [key: string]: unknown;
}

interface ASRRequest {
  file_base64?: string;
  file?: unknown;
  [key: string]: unknown;
}

interface ASRResponse {
  text: string;
  language?: string;
  duration?: number;
}

interface SearchResult {
  name: string;
  snippet: string;
  url: string;
  [key: string]: unknown;
}

/** ZHIPU JWT token generator (HS256, valid 1 hour).
 *
 * Follows ZHIPU's official spec:
 *   header:    {"alg": "HS256", "sign_type": "SIGN"}
 *   payload:   {"api_key": <id>, "exp": <ms>, "timestamp": <ms>}
 *   encoding:  urlsafe base64 (no padding) for all 3 parts
 *   exp/timestamp are in MILLISECONDS, not seconds
 *
 * Reference: https://open.bigmodel.cn/dev/api#nosdk
 */
async function zhipuJwt(apiKey: string): Promise<string> {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) {
    throw new Error('Invalid ZHIPU_API_KEY format (expected id.secret)');
  }

  const enc = new TextEncoder();

  // urlsafe base64 (no padding) — used for all 3 parts of the JWT
  function b64url(data: ArrayBuffer | Uint8Array): string {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  const headerJson = JSON.stringify({ alg: 'HS256', sign_type: 'SIGN' });
  // exp = 1 hour from now in MILLISECONDS; timestamp in MILLISECONDS
  const nowMs = Date.now();
  const payloadJson = JSON.stringify({
    api_key: id,
    exp: nowMs + 3600 * 1000,
    timestamp: nowMs,
  });

  const headerB64 = b64url(enc.encode(headerJson));
  const payloadB64 = b64url(enc.encode(payloadJson));
  const signInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(signInput));
  const sigB64 = b64url(sigBytes);

  return `${signInput}.${sigB64}`;
}

/** DuckDuckGo HTML search (no API key needed). */
async function duckDuckGoSearch(query: string, num: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  });
  if (!resp.ok) {
    throw new Error(`DuckDuckGo HTTP ${resp.status}`);
  }
  const html = await resp.text();
  const results: SearchResult[] = [];
  // Parse result blocks
  const blockRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) && results.length < num) {
    const rawUrl = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    // DuckDuckGo wraps URLs in a redirect; extract actual URL
    const urlMatch = rawUrl.match(/uddg=([^&]+)/);
    const actualUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;
    if (title && actualUrl) {
      results.push({ name: title, snippet, url: actualUrl });
    }
  }
  return results;
}

/** ZHIPU web_search via bigmodel API. */
async function zhipuWebSearch(query: string, num: number, apiKey: string): Promise<SearchResult[]> {
  const token = await zhipuJwt(apiKey);
  const resp = await fetch(`${ZHIPU_BASE_URL}/tools`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      request_id: `search-${Date.now()}`,
      tool: 'web-search-pro',
      messages: [{ role: 'user', content: query }],
      stream: false,
    }),
  });
  if (!resp.ok) {
    throw new Error(`ZHIPU web_search HTTP ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json() as { choices?: Array<{ message?: { tool_calls?: Array<{ search_result?: SearchResult[] }> } }> };
  const results: SearchResult[] = [];
  const choices = data.choices || [];
  for (const c of choices) {
    const calls = c.message?.tool_calls || [];
    for (const call of calls) {
      if (Array.isArray(call.search_result)) {
        for (const r of call.search_result) {
          if (r && r.url) {
            results.push({
              name: r.name || r.title || '',
              snippet: r.snippet || r.content || '',
              url: r.url,
            });
          }
        }
      }
    }
    if (results.length >= num) break;
  }
  return results.slice(0, num);
}

export class MultiBackendAdapter {
  private deepseekKey: string;
  private zhipuKey?: string;
  private openaiKey?: string;

  constructor(deepseekKey: string) {
    this.deepseekKey = deepseekKey;
    this.zhipuKey = process.env.ZHIPU_API_KEY?.trim() || undefined;
    this.openaiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  }

  /** Which backends are configured? */
  getBackends(): { chat: string; vision?: string; image?: string; tts?: string; asr?: string; search: string } {
    return {
      chat: 'deepseek',
      vision: this.zhipuKey ? 'zhipu' : (this.openaiKey ? 'openai' : undefined),
      image: this.zhipuKey ? 'zhipu' : (this.openaiKey ? 'openai' : undefined),
      tts: this.zhipuKey ? 'zhipu' : (this.openaiKey ? 'openai' : undefined),
      asr: this.openaiKey ? 'openai' : undefined,
      search: 'duckduckgo' + (this.zhipuKey ? '+zhipu' : ''),
    };
  }

  chat = {
    completions: {
      create: async (params: ChatCompletionRequest): Promise<ChatCompletionResponse | AsyncIterable<StreamChunk>> => {
        const { backend, model } = getChatBackend(params.model);
        const body = {
          model,
          messages: params.messages,
          stream: params.stream ?? false,
          ...(params.temperature !== undefined && { temperature: params.temperature }),
          ...(params.max_tokens !== undefined && { max_tokens: params.max_tokens }),
        };

        // Determine URL + headers based on backend
        let url: string;
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (backend === 'zhipu' && this.zhipuKey) {
          url = `${ZHIPU_BASE_URL}/chat/completions`;
          const token = await zhipuJwt(this.zhipuKey);
          headers.Authorization = `Bearer ${token}`;
        } else if (backend === 'deepseek' && this.deepseekKey) {
          url = `${DEEPSEEK_BASE_URL}/chat/completions`;
          headers.Authorization = `Bearer ${this.deepseekKey}`;
        } else if (backend === 'openai' && this.openaiKey) {
          url = `${OPENAI_BASE_URL}/chat/completions`;
          headers.Authorization = `Bearer ${this.openaiKey}`;
        } else {
          // Last resort: try ZHIPU even if key check failed
          if (this.zhipuKey) {
            url = `${ZHIPU_BASE_URL}/chat/completions`;
            const token = await zhipuJwt(this.zhipuKey);
            headers.Authorization = `Bearer ${token}`;
          } else {
            throw new Error('No chat backend available. Set ZHIPU_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY.');
          }
        }

        if (params.stream) {
          async function* gen(): AsyncIterable<StreamChunk> {
            const resp = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });
            if (!resp.ok) {
              throw new Error(`Chat API (${backend}) error ${resp.status}: ${await resp.text()}`);
            }
            if (!resp.body) throw new Error('Chat stream: empty body');
            const reader = resp.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') return;
                try {
                  yield JSON.parse(data) as StreamChunk;
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          }
          return gen();
        }

        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          throw new Error(`Chat API (${backend}) error ${resp.status}: ${await resp.text()}`);
        }
        return (await resp.json()) as ChatCompletionResponse;
      },

      createVision: async (params: {
        model?: string;
        messages: Array<{
          role: string;
          content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
        }>;
        thinking?: { type: string };
        [key: string]: unknown;
      }): Promise<ChatCompletionResponse> => {
        // Try ZHIPU GLM-4V first
        if (this.zhipuKey) {
          try {
            const token = await zhipuJwt(this.zhipuKey);
            const resp = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                model: 'glm-4v-plus',
                messages: params.messages,
                stream: false,
              }),
            });
            if (!resp.ok) {
              throw new Error(`ZHIPU VLM HTTP ${resp.status}: ${await resp.text()}`);
            }
            return (await resp.json()) as ChatCompletionResponse;
          } catch (err) {
            console.error('[VLM] ZHIPU failed, trying OpenAI:', err);
          }
        }
        // Fallback to OpenAI GPT-4V
        if (this.openaiKey) {
          const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.openaiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: params.messages,
              stream: false,
            }),
          });
          if (!resp.ok) {
            throw new Error(`OpenAI VLM HTTP ${resp.status}: ${await resp.text()}`);
          }
          return (await resp.json()) as ChatCompletionResponse;
        }
        throw new Error(
          'Vision API requires ZHIPU_API_KEY or OPENAI_API_KEY. Configure one in .env to enable image analysis.'
        );
      },
    },
  };

  images = {
    generations: {
      create: async (params: ImageGenRequest): Promise<ImageGenResponse> => {
        // Try ZHIPU CogView-3 first
        if (this.zhipuKey) {
          try {
            const token = await zhipuJwt(this.zhipuKey);
            const resp = await fetch(`${ZHIPU_BASE_URL}/images/generations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                model: 'cogview-3-plus',
                prompt: params.prompt,
                size: params.size || '1024x1024',
              }),
            });
            if (!resp.ok) {
              throw new Error(`ZHIPU image gen HTTP ${resp.status}: ${await resp.text()}`);
            }
            const data = await resp.json() as { data?: Array<{ url?: string; b64_json?: string }> };
            const items = data.data || [];
            if (items.length === 0) {
              throw new Error('ZHIPU returned empty image data');
            }
            // If URL returned, fetch the image and convert to base64
            if (items[0].url) {
              const imgResp = await fetch(items[0].url);
              if (imgResp.ok) {
                const buf = Buffer.from(await imgResp.arrayBuffer());
                return { data: [{ base64: buf.toString('base64'), url: items[0].url }] };
              }
            }
            if (items[0].b64_json) {
              return { data: [{ base64: items[0].b64_json }] };
            }
            throw new Error('ZHIPU image gen: no url or b64_json in response');
          } catch (err) {
            console.error('[Image] ZHIPU failed, trying OpenAI:', err);
          }
        }
        // Fallback to OpenAI DALL-E 3
        if (this.openaiKey) {
          const resp = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.openaiKey}`,
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: params.prompt,
              size: params.size || '1024x1024',
              n: 1,
              response_format: 'b64_json',
            }),
          });
          if (!resp.ok) {
            throw new Error(`OpenAI image gen HTTP ${resp.status}: ${await resp.text()}`);
          }
          const data = await resp.json() as { data?: Array<{ b64_json?: string; url?: string }> };
          const item = data.data?.[0];
          if (!item) throw new Error('OpenAI returned empty image data');
          return { data: [{ base64: item.b64_json || '', url: item.url }] };
        }
        throw new Error(
          'Image generation requires ZHIPU_API_KEY or OPENAI_API_KEY. Configure one in .env to enable image generation.'
        );
      },
    },
  };

  audio = {
    tts: {
      create: async (params: TTSRequest): Promise<Response> => {
        // Try ZHIPU CogTTS first
        if (this.zhipuKey) {
          try {
            const token = await zhipuJwt(this.zhipuKey);
            const resp = await fetch(`${ZHIPU_BASE_URL}/audio/speech`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                model: 'cogtts',
                input: params.input,
                voice: params.voice || 'tongtong',
              }),
            });
            if (resp.ok) {
              return resp;
            }
            throw new Error(`ZHIPU TTS HTTP ${resp.status}: ${await resp.text()}`);
          } catch (err) {
            console.error('[TTS] ZHIPU failed, trying OpenAI:', err);
          }
        }
        // Fallback to OpenAI TTS
        if (this.openaiKey) {
          const resp = await fetch(`${OPENAI_BASE_URL}/audio/speech`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.openaiKey}`,
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: params.input,
              voice: 'alloy',
              speed: params.speed || 1.0,
              response_format: 'mp3',
            }),
          });
          if (!resp.ok) {
            throw new Error(`OpenAI TTS HTTP ${resp.status}: ${await resp.text()}`);
          }
          return resp;
        }
        throw new Error(
          'TTS requires ZHIPU_API_KEY or OPENAI_API_KEY. Configure one in .env to enable text-to-speech.'
        );
      },
    },

    asr: {
      create: async (params: ASRRequest): Promise<ASRResponse> => {
        if (!params.file_base64) {
          throw new Error('ASR requires file_base64 parameter');
        }
        // Only OpenAI Whisper supported (ZHIPU ASR is more complex, not commonly used)
        if (!this.openaiKey) {
          throw new Error(
            'ASR requires OPENAI_API_KEY (Whisper). Configure one in .env to enable speech-to-text.'
          );
        }
        // Convert base64 to Blob for FormData
        const buffer = Buffer.from(params.file_base64, 'base64');
        const blob = new Blob([buffer], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', blob, 'audio.wav');
        formData.append('model', 'whisper-1');
        formData.append('language', 'zh');

        const resp = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
          },
          body: formData,
        });
        if (!resp.ok) {
          throw new Error(`OpenAI Whisper HTTP ${resp.status}: ${await resp.text()}`);
        }
        const data = await resp.json() as { text?: string };
        return { text: data.text || '', language: 'zh' };
      },
    },
  };

  functions = {
    invoke: async (name: string, args: unknown): Promise<unknown> => {
      if (name === 'web_search') {
        const { query, num = 10 } = args as { query: string; num?: number };
        if (!query) throw new Error('web_search requires query');

        // Try ZHIPU first if available (higher quality)
        if (this.zhipuKey) {
          try {
            const results = await zhipuWebSearch(query, num, this.zhipuKey);
            if (results.length > 0) return results;
          } catch (err) {
            console.error('[Search] ZHIPU failed, falling back to DuckDuckGo:', err);
          }
        }
        // Fallback to DuckDuckGo (always works, no key)
        return duckDuckGoSearch(query, num);
      }
      throw new Error(`Function "${name}" not supported by MultiBackendAdapter.`);
    },
  };
}

export type MultiBackendAdapterInstance = InstanceType<typeof MultiBackendAdapter>;
