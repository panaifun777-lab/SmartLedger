import ZAI from 'z-ai-web-dev-sdk';
import { getAI, SYSTEM_PROMPT, extractMemories, getRelevantKeywords } from '@/lib/ai';
import { db } from '@/lib/db';
import { getDefaultModel } from '@/lib/models';
import {
  IntentType,
  TaskStep,
  TaskPlan,
  PlanContext,
  PlanEvent,
  StepResult,
  StepType,
  OrchestratorConfig,
  DEFAULT_CONFIG,
} from './types';
import fs from 'fs';
import path from 'path';

// ============================================================
// Intent Classification
// ============================================================

/** Rule-based intent patterns (fast, no LLM call needed) */
const INTENT_PATTERNS: Array<{ patterns: RegExp[]; intent: IntentType }> = [
  // Multi-step intent (check first - more specific patterns)
  {
    patterns: [
      /(?:搜索|查找|查一下).*(?:然后|再|之后).*(?:生成|画|创建)/,
      /(?:搜索|查找).*(?:图片|图像|画)/,
      /(?:分析|识别).*(?:图片|图像|照片).*(?:然后|再|之后).*(?:朗读|读|说)/,
      /(?:search).*(?:then|after).*(?:generate|create|draw)/i,
    ],
    intent: 'multi_step',
  },
  // Search intent (more specific patterns to avoid false positives)
  {
    patterns: [
      /(?:搜索|搜一下|搜搜看|帮我搜|搜索一下|查一下|查查|查找|查找一下)/,
      /(?:最新的|最近的|当前的|目前的).*(?:新闻|资讯|消息|动态|技术|信息|发展|进展)/,
      /(?:今天|今日|现在|当前).*(?:新闻|资讯|消息|动态|发生了什么)/,
      /(?:有什么|有哪些).*(?:新闻|资讯|消息|动态)/,
      /(?:新闻|资讯).*(?:最新|最近|今天|今日|当前)/,
      /(?:search for|look up|find info|latest news|current events)/i,
    ],
    intent: 'search',
  },
  // Image generation intent
  {
    patterns: [
      /(?:生成|画|绘制|创作).*(?:图片|图像|画|插画|海报|风景|头像)/,
      /(?:图片|图像|画|插画|海报).*(?:生成|画|绘制|创作)/,
      /(?:generate|create|draw).*(?:image|picture|illustration|artwork)/i,
    ],
    intent: 'tool_task',
  },
  // TTS intent
  {
    patterns: [
      /(?:朗读|读出|念出来|说出来|播放|读一下).*(?:文字|内容|这段)/,
      /(?:read aloud|text to speech|speak out)/i,
    ],
    intent: 'tool_task',
  },
  // Knowledge / memory retrieval intent
  {
    patterns: [
      /(?:你还记得|你记不记得|上次|之前|以前).*(?:说的|讨论的|聊的|提到的)/,
      /(?:我的|咱们的).*(?:偏好|习惯|信息|名字|工作|住)/,
      /(?:recall|remember|what did i|what do you know about me)/i,
    ],
    intent: 'knowledge',
  },
];

/**
 * Classify user intent using rule-based matching (fast).
 * Falls back to 'simple_qa' for unmatched messages.
 */
export function classifyIntent(
  message: string,
  tools: string[] = [],
  hasImage = false,
  hasAudio = false
): IntentType {
  // If VLM tool is active with an image, it's a tool task
  if (tools.includes('vlm') && hasImage) return 'tool_task';
  // If ASR tool is active with audio, it's a tool task
  if (tools.includes('asr') && hasAudio) return 'tool_task';
  // If explicit tool selection includes image_gen or tts, it's tool task
  if (tools.includes('image_gen') || tools.includes('tts')) return 'tool_task';
  // If web_search tool is explicitly selected, it's search
  if (tools.includes('web_search')) return 'search';

  // Check rule-based patterns
  for (const { patterns, intent } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return intent;
      }
    }
  }

  // Default: simple Q&A
  return 'simple_qa';
}

// ============================================================
// Plan Creation
// ============================================================

let stepCounter = 0;

function nextStepId(): string {
  stepCounter += 1;
  return `step-${stepCounter}`;
}

function makeStep(
  type: StepType,
  name: string,
  icon: string,
  opts: Partial<TaskStep> = {}
): TaskStep {
  return {
    id: nextStepId(),
    type,
    name,
    icon,
    status: 'pending',
    ...opts,
  };
}

/**
 * Create an execution plan based on intent, message, and available tools.
 */
export function createPlan(
  intent: IntentType,
  message: string,
  tools: string[] = [],
  hasImage = false,
  hasAudio = false
): TaskPlan {
  stepCounter = 0;
  const steps: TaskStep[] = [];

  switch (intent) {
    case 'simple_qa': {
      // Just a direct LLM call, optionally with RAG
      if (tools.length === 0) {
        steps.push(makeStep('rag_search', '检索相关记忆', '🧠'));
        steps.push(makeStep('llm_call', '生成回复', '💬'));
      } else {
        // If tools are selected but intent is simple_qa, still do RAG + LLM
        steps.push(makeStep('rag_search', '检索相关记忆', '🧠'));
        steps.push(makeStep('llm_call', '生成回复', '💬'));
      }
      break;
    }

    case 'search': {
      steps.push(makeStep('rag_search', '检索相关记忆', '🧠'));
      steps.push(makeStep('web_search', '搜索网络信息', '🔍', { input: message }));
      steps.push(makeStep('llm_call', '综合搜索结果生成回复', '💬'));
      break;
    }

    case 'tool_task': {
      // Always start with RAG for context
      steps.push(makeStep('rag_search', '检索相关记忆', '🧠'));

      // VLM: analyze image first
      if (tools.includes('vlm') && hasImage) {
        steps.push(makeStep('vlm', '分析图片内容', '👁️'));
      }

      // ASR: transcribe audio first
      if (tools.includes('asr') && hasAudio) {
        steps.push(makeStep('asr', '转录语音内容', '🎤'));
      }

      // Web search if needed
      if (tools.includes('web_search')) {
        steps.push(makeStep('web_search', '搜索网络信息', '🔍', { input: message }));
      }

      // LLM call (always)
      steps.push(makeStep('llm_call', '生成回复', '💬'));

      // Image generation (after LLM)
      if (tools.includes('image_gen')) {
        steps.push(makeStep('image_gen', '生成图像', '🎨', { input: message }));
      }

      // TTS (after LLM, uses LLM output)
      if (tools.includes('tts')) {
        steps.push(makeStep('tts', '语音合成', '🔊'));
      }
      break;
    }

    case 'knowledge': {
      steps.push(makeStep('rag_search', '检索记忆库', '🧠', { description: '深度检索相关记忆和知识' }));
      steps.push(makeStep('llm_call', '基于记忆生成回复', '💬'));
      break;
    }

    case 'multi_step': {
      // Always start with RAG
      steps.push(makeStep('rag_search', '检索相关记忆', '🧠'));

      // Web search first for multi-step
      if (tools.includes('web_search') || /搜索|查找|search/i.test(message)) {
        steps.push(makeStep('web_search', '搜索网络信息', '🔍', { input: message }));
      }

      // VLM if image present
      if (tools.includes('vlm') && hasImage) {
        steps.push(makeStep('vlm', '分析图片内容', '👁️'));
      }

      // ASR if audio present
      if (tools.includes('asr') && hasAudio) {
        steps.push(makeStep('asr', '转录语音内容', '🎤'));
      }

      // LLM synthesis
      steps.push(makeStep('llm_call', '综合分析生成回复', '💬'));

      // Image gen if requested
      if (tools.includes('image_gen') || /生成.*图|画.*图|create.*image|generate.*image/i.test(message)) {
        steps.push(makeStep('image_gen', '生成图像', '🎨', { input: message }));
      }

      // TTS if requested
      if (tools.includes('tts') || /朗读|读出|read aloud|speak/i.test(message)) {
        steps.push(makeStep('tts', '语音合成', '🔊'));
      }
      break;
    }
  }

  return {
    id: `plan-${Date.now()}`,
    intent,
    message,
    steps,
    createdAt: Date.now(),
  };
}

// ============================================================
// Plan Execution
// ============================================================

/**
 * Execute a task plan step by step, yielding PlanEvents as SSE.
 */
export async function* executePlan(
  plan: TaskPlan,
  context: PlanContext,
  config: OrchestratorConfig = DEFAULT_CONFIG
): AsyncGenerator<PlanEvent> {
  const ai = await getAI();
  const completedSteps: TaskStep[] = [];
  let toolsUsed: string[] = [];

  // Yield the plan first
  yield { type: 'plan', plan };

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    step.status = 'running';
    step.startedAt = Date.now();

    // Yield step start
    yield { type: 'step_start', stepId: step.id, stepName: step.name, stepIcon: step.icon };

    try {
      const result = await executeStep(step, ai, context, config, plan);
      step.status = 'completed';
      step.completedAt = Date.now();
      step.duration = step.completedAt - step.startedAt;
      step.output = result;

      // Store result in context for next steps
      context.stepResults.set(step.id, result);

      // Track tools used
      if (step.type !== 'llm_call' && step.type !== 'rag_search') {
        if (!toolsUsed.includes(step.type)) {
          toolsUsed.push(step.type);
        }
      }
      if (step.type === 'web_search') toolsUsed.push('web_search');

      completedSteps.push(step);

      // Yield step result
      yield { type: 'step_result', stepId: step.id, result, duration: step.duration };

      // Yield special events for images and audio
      if (result.images) {
        for (const img of result.images) {
          yield { type: 'image', url: img.url, prompt: img.prompt };
        }
      }
      if (result.audioUrl) {
        yield { type: 'audio', url: result.audioUrl };
      }
      if (result.searchResults && result.searchResults.length > 0) {
        yield { type: 'search_results', query: step.input || context.message, count: result.searchResults.length };
      }

      // Add result content to chat messages for LLM context
      if (step.type === 'web_search' && result.searchResults) {
        const searchContext = result.searchResults
          .map((r, idx) => `${idx + 1}. ${r.name}: ${r.snippet} (${r.url})`)
          .join('\n');
        context.chatMessages.push({
          role: 'system',
          content: `Web search results:\n${searchContext}\n\nUse this information to answer the user's question. Always cite your sources.`,
        });
      } else if (step.type === 'vlm' && result.content) {
        context.chatMessages.push({
          role: 'system',
          content: `Image analysis result (VLM):\n${result.content}\n\nThe user's message may reference this image. Use this analysis to provide a better response.`,
        });
      } else if (step.type === 'asr' && result.content) {
        context.chatMessages.push({
          role: 'system',
          content: `Audio transcription (ASR):\n${result.content}\n\nThe user's message may reference this audio. Use this transcription to provide a better response.`,
        });
      } else if (step.type === 'rag_search' && result.content) {
        context.chatMessages.push({
          role: 'system',
          content: result.content,
        });
      }
    } catch (err) {
      step.status = 'error';
      step.completedAt = Date.now();
      step.duration = step.completedAt - step.startedAt;
      step.error = err instanceof Error ? err.message : 'Unknown error';

      yield { type: 'step_error', stepId: step.id, error: step.error };

      // Continue to next step if possible
      // For non-critical steps (image_gen, tts), we can skip
      if (step.type === 'image_gen' || step.type === 'tts') {
        continue;
      }
      // For critical steps, add error context and continue
      context.chatMessages.push({
        role: 'system',
        content: `Note: Step "${step.name}" failed with error: ${step.error}. Continue without this information if possible.`,
      });
    }
  }

  // Compute final content from the last LLM step
  let finalContent = '';
  for (let i = completedSteps.length - 1; i >= 0; i--) {
    if (completedSteps[i].type === 'llm_call' && completedSteps[i].output) {
      finalContent = completedSteps[i].output!.content;
      break;
    }
  }

  // De-duplicate toolsUsed
  toolsUsed = [...new Set(toolsUsed)];

  yield {
    type: 'final_result',
    content: finalContent,
    stepsCompleted: completedSteps.filter((s) => s.status === 'completed').length,
    totalSteps: plan.steps.length,
    toolsUsed,
  };
}

// ============================================================
// Step Execution Functions
// ============================================================

async function executeStep(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext,
  config: OrchestratorConfig,
  plan: TaskPlan
): Promise<StepResult> {
  switch (step.type) {
    case 'rag_search':
      return executeRagSearch(step, ai, context);
    case 'web_search':
      return executeWebSearch(step, ai, context);
    case 'llm_call':
      return executeLlmCall(step, ai, context, config, plan);
    case 'image_gen':
      return executeImageGen(step, ai, context);
    case 'tts':
      return executeTts(step, ai, context, config);
    case 'vlm':
      return executeVlm(step, ai, context);
    case 'asr':
      return executeAsr(step, ai, context);
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

/** RAG Search: retrieve relevant memories from the database */
async function executeRagSearch(
  _step: TaskStep,
  _ai: ZAI,
  context: PlanContext
): Promise<StepResult> {
  const keywords = getRelevantKeywords(context.message);
  let relevantMemories: Array<{ id: string; content: string; memoryType: string }> = [];

  if (keywords.length > 0) {
    const allActiveMemories = await db.memoryItem.findMany({
      where: { status: 'active' },
      select: { id: true, content: true, memoryType: true },
      take: 100,
    });

    relevantMemories = allActiveMemories
      .filter((m) => {
        const contentLower = m.content.toLowerCase();
        return keywords.some((kw) => contentLower.includes(kw));
      })
      .slice(0, 10);
  }

  // Store for later use (e.g., memory refs in saved messages)
  context.relevantMemories = relevantMemories;

  let content = '';
  if (relevantMemories.length > 0) {
    const memoryContext = relevantMemories
      .map((m) => `[${m.memoryType}] ${m.content}`)
      .join('\n');
    content = `Relevant memories about the user:\n${memoryContext}`;
  }

  return {
    type: 'rag_search',
    content,
    data: { memoryCount: relevantMemories.length },
    metadata: { memoryIds: relevantMemories.map((m) => m.id) },
  };
}

/** Web Search: search the web using AI SDK */
async function executeWebSearch(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext
): Promise<StepResult> {
  const searchQuery = extractSearchQuery(step.input || context.message);
  step.input = searchQuery;

  const searchResults = await ai.functions.invoke('web_search', {
    query: searchQuery,
    num: 5,
  });

  const results: Array<{ name: string; snippet: string; url: string }> = [];
  if (Array.isArray(searchResults) && searchResults.length > 0) {
    for (const r of searchResults) {
      results.push({
        name: r.name || '',
        snippet: r.snippet || '',
        url: r.url || '',
      });
    }
  }

  return {
    type: 'web_search',
    content: results.length > 0
      ? results.map((r, i) => `${i + 1}. ${r.name}: ${r.snippet}`).join('\n')
      : 'No search results found.',
    searchResults: results,
  };
}

/** LLM Call: stream tokens from the LLM */
async function executeLlmCall(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext,
  _config: OrchestratorConfig,
  plan: TaskPlan
): Promise<StepResult> {
  // Build the chat messages for this LLM call
  const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Add all context from previous steps (already accumulated in context.chatMessages)
  chatMessages.push(...context.chatMessages);

  // Add context about planned steps after this LLM call
  const currentStepIndex = plan.steps.findIndex((s) => s.id === step.id);
  const subsequentSteps = plan.steps.slice(currentStepIndex + 1);
  const plannedActions: string[] = [];
  for (const nextStep of subsequentSteps) {
    if (nextStep.type === 'image_gen') {
      plannedActions.push('图像将在你的回复后自动生成，无需你在回复中提及生成图片');
    } else if (nextStep.type === 'tts') {
      plannedActions.push('你的回复将被转换为语音播放');
    }
  }
  if (plannedActions.length > 0) {
    chatMessages.push({
      role: 'system',
      content: `注意：${plannedActions.join('；')}。请直接回答用户的问题即可。`,
    });
  }

  // Add the user's message
  chatMessages.push({ role: 'user', content: context.message });

  let fullResponse = '';

  // Determine which model to use: user-selected > config default > system default
  const selectedModel = context.model || _config.llmModel || getDefaultModel().id;

  try {
    // Try non-streaming first (more reliable with z-ai-web-dev-sdk)
    const completion = await ai.chat.completions.create({
      model: selectedModel,
      messages: chatMessages,
      stream: false,
    });
    fullResponse =
      completion?.choices?.[0]?.message?.content ||
      completion?.content ||
      (typeof completion === 'string'
        ? completion
        : '');
  } catch (llmError) {
    console.error('[Orchestrator] Non-streaming LLM error:', llmError);
    // Try streaming as fallback
    try {
      const llmStream = await ai.chat.completions.create({
        model: selectedModel,
        messages: chatMessages,
        stream: true,
      });

      for await (const chunk of llmStream) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
        }
      }
    } catch (streamError) {
      console.error('[Orchestrator] Streaming LLM error:', streamError);
    }
  }

  if (!fullResponse) {
    fullResponse = '抱歉，我无法生成回复。请稍后再试。';
  }

  return {
    type: 'llm_call',
    content: fullResponse,
  };
}

/** Image Generation */
async function executeImageGen(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext
): Promise<StepResult> {
  const prompt = step.input || context.message;

  const imageResponse = await ai.images.generations.create({
    prompt: prompt,
    size: '1024x1024',
  });

  const imageBase64Result = imageResponse.data[0].base64;
  const filename = `img_${Date.now()}.png`;
  const publicDir = path.join(process.cwd(), 'public', 'generated');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const filepath = path.join(publicDir, filename);
  const imageBuffer = Buffer.from(imageBase64Result, 'base64');
  fs.writeFileSync(filepath, imageBuffer);

  return {
    type: 'image_gen',
    content: `Generated image for: ${prompt}`,
    images: [{ url: `/generated/${filename}`, prompt }],
  };
}

/** Text-to-Speech */
async function executeTts(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext,
  config: OrchestratorConfig
): Promise<StepResult> {
  // Find the LLM output to use as TTS input
  let ttsText = '';
  for (const [, result] of context.stepResults) {
    if (result.type === 'llm_call') {
      ttsText = result.content;
    }
  }
  if (!ttsText) {
    ttsText = context.message;
  }

  ttsText = ttsText.trim().substring(0, 1024);

  const ttsResponse = await ai.audio.tts.create({
    input: ttsText,
    voice: config.ttsVoice || 'tongtong',
    speed: config.ttsSpeed || 1.0,
    response_format: 'mp3',
    stream: false,
  });

  const ttsArrayBuffer = await ttsResponse.arrayBuffer();
  const ttsBuffer = Buffer.from(new Uint8Array(ttsArrayBuffer));
  const audioFilename = `tts_${Date.now()}.mp3`;
  const audioPublicDir = path.join(process.cwd(), 'public', 'generated');
  if (!fs.existsSync(audioPublicDir)) {
    fs.mkdirSync(audioPublicDir, { recursive: true });
  }
  const audioFilepath = path.join(audioPublicDir, audioFilename);
  fs.writeFileSync(audioFilepath, ttsBuffer);

  return {
    type: 'tts',
    content: `Generated speech for text: ${ttsText.substring(0, 100)}...`,
    audioUrl: `/generated/${audioFilename}`,
  };
}

/** Vision Language Model - Analyze image */
async function executeVlm(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext
): Promise<StepResult> {
  let vlmImageUrl: string;
  if (context.imageBase64) {
    vlmImageUrl = context.imageBase64.startsWith('data:')
      ? context.imageBase64
      : `data:image/png;base64,${context.imageBase64}`;
  } else if (context.imageUrl) {
    vlmImageUrl = context.imageUrl;
  } else {
    throw new Error('No image data available for VLM analysis');
  }

  const vlmResponse = await ai.chat.completions.createVision({
    model: 'glm-4v-flash',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '详细描述这张图片的内容，包括关键元素、场景、文字等信息。' },
          { type: 'image_url', image_url: { url: vlmImageUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  });

  const analysis = vlmResponse.choices?.[0]?.message?.content || '';

  return {
    type: 'vlm',
    content: analysis || '无法分析图片',
  };
}

/** Speech-to-Text - Transcribe audio */
async function executeAsr(
  step: TaskStep,
  ai: ZAI,
  context: PlanContext
): Promise<StepResult> {
  let base64Audio: string;
  if (context.audioBase64) {
    base64Audio = context.audioBase64;
  } else if (context.audioUrl) {
    const audioResponse = await fetch(context.audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    base64Audio = audioBuffer.toString('base64');
  } else {
    throw new Error('No audio data available for ASR transcription');
  }

  const asrResponse = await ai.audio.asr.create({
    file_base64: base64Audio,
  });

  const transcription = asrResponse.text || '';

  return {
    type: 'asr',
    content: transcription || '无法识别语音',
  };
}

// ============================================================
// Helper: Extract search query (same as in stream route)
// ============================================================

function extractSearchQuery(message: string): string {
  const chinesePatterns = [
    /(?:搜索|搜一下|搜搜看|帮我搜|搜索一下|查一下|查查|查找|查找一下)\s*(.+)/,
    /(?:最新的|最近的|当前的|目前的)\s*(.+)/,
    /(?:新闻|资讯|消息)\s*(.+)/,
    /(.+?)\s*(?:的最新消息|的最新新闻|的最新资讯|的最新动态|的最新信息)/,
    /(.+?)\s*(?:是什么|怎么样|如何|多少钱|什么时候)/,
  ];

  for (const pattern of chinesePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  const englishPatterns = [
    /(?:search for|look up|find info(?:rmation)? about|search)\s+(.+)/i,
    /(?:what is the latest|what is the current|what are the recent)\s+(.+)/i,
    /(?:recent news|latest news|current events)\s*(?:about|on)?\s*(.+)/i,
  ];

  for (const pattern of englishPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  return message.trim().substring(0, 100);
}

// ============================================================
// Helper: Build initial plan context
// ============================================================

export function buildPlanContext(
  message: string,
  conversationId?: string,
  tools: string[] = [],
  imageUrl?: string,
  imageBase64?: string,
  audioUrl?: string,
  audioBase64?: string,
  model?: string
): PlanContext {
  return {
    message,
    conversationId,
    tools,
    stepResults: new Map(),
    chatMessages: [],
    imageUrl,
    imageBase64,
    audioUrl,
    audioBase64,
    model,
  };
}
