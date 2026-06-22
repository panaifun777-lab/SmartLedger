import ZAI from 'z-ai-web-dev-sdk';
import { MultiBackendAdapter } from './deepseek-adapter';

type AnyAI = ZAI | MultiBackendAdapter;

let aiInstance: AnyAI | null = null;
let aiInitError: string | null = null;
let aiProvider: 'multibackend' | 'zai' | null = null;

/**
 * Get the AI client.
 *
 * Strategy:
 * 1. If DEEPSEEK_API_KEY is set (production VPS deployment),
 *    use MultiBackendAdapter — calls DeepSeek for chat directly,
 *    and routes vision/image/tts/asr/search to ZHIPU or OpenAI based on env.
 * 2. Otherwise, fall back to z-ai-web-dev-sdk (local dev / z.ai sandbox).
 */
export async function getAI(): Promise<AnyAI> {
  if (aiInstance) return aiInstance;
  if (aiInitError) throw new Error(aiInitError);

  // 1. Try MultiBackendAdapter if DeepSeek key is configured
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    try {
      aiInstance = new MultiBackendAdapter(deepseekKey);
      aiProvider = 'multibackend';
      const backends = (aiInstance as MultiBackendAdapter).getBackends();
      console.log('[AI] Using MultiBackendAdapter (production mode):', backends);
      return aiInstance;
    } catch (err) {
      console.warn('[AI] MultiBackendAdapter init failed, falling back to ZAI SDK:', err);
    }
  }

  // 2. Fall back to z-ai-web-dev-sdk (dev environment)
  try {
    aiInstance = await ZAI.create();
    aiProvider = 'zai';
    console.log('[AI] Using z-ai-web-dev-sdk (dev mode)');
    return aiInstance;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to initialize AI SDK';
    aiInitError = errorMsg;
    console.error('[AI] SDK initialization failed:', errorMsg);
    throw new Error(
      `AI SDK not available. Set DEEPSEEK_API_KEY env var (chat), and optionally ZHIPU_API_KEY (vision/image/tts) or OPENAI_API_KEY (vision/tts/asr). Original error: ${errorMsg}`
    );
  }
}

/**
 * Reset the AI instance (useful if config changes)
 */
export function resetAI(): void {
  aiInstance = null;
  aiInitError = null;
  aiProvider = null;
}

/**
 * Which backend is currently active?
 */
export function getAIProvider(): 'multibackend' | 'zai' | null {
  return aiProvider;
}

/**
 * System prompt for the AVATAR Agent
 */
export const SYSTEM_PROMPT = `你是 SmartLedger Agent，一个智能、友好的个人 AI 助手。你具备长期记忆能力，能记住用户跨对话的重要信息。

行为准则：
- 使用中文回答，简洁、专业、友好
- 当用户分享个人事实、偏好或重要细节时，主动确认并记住
- 回答要准确、有条理，适当使用格式化（列表、标题等）
- 如果不确定，坦诚说明
- 需要时可以使用网络搜索工具提供最新、准确的信息
- 始终优先考虑有用性和准确性

记忆意识：
- 你可以访问用户的存储记忆（事实、偏好、技能等）
- 回答时考虑上下文中提供的相关记忆
- 如果用户更正或更新信息，确认更新`;

/**
 * Memory extraction patterns for auto-saving
 */
const MEMORY_PATTERNS = [
  { regex: /(?:我叫|我的名字是|我是)\s*(.+?)[。！？，\s]*$/im, type: 'fact', template: '用户名称: $1' },
  { regex: /(?:我偏好|我喜欢|我热爱|我享受)\s*(.+?)[。！？，\s]*$/im, type: 'preference', template: '用户偏好: $1' },
  { regex: /(?:我不喜欢|我讨厌|我反感)\s*(.+?)[。！？，\s]*$/im, type: 'preference', template: '用户不喜欢: $1' },
  { regex: /(?:我总是|我通常|我一般|我习惯)\s*(.+?)[。！？，\s]*$/im, type: 'rule', template: '用户习惯: $1' },
  { regex: /(?:我在|我的工作|我从事|我是一名)\s*(.+?)[。！？，\s]*$/im, type: 'fact', template: '用户职业: $1' },
  { regex: /(?:我住在|我的家在|我来自)\s*(.+?)[。！？，\s]*$/im, type: 'fact', template: '用户位置: $1' },
  { regex: /(?:my name is|i'm called|call me)\s+(.+?)[.!?,;\s]*$/im, type: 'fact', template: 'User name: $1' },
  { regex: /(?:i prefer|i like|i love|i enjoy)\s+(.+?)[.!?,;\s]*$/im, type: 'preference', template: 'User prefers: $1' },
  { regex: /(?:i always|i usually|i typically)\s+(.+?)[.!?,;\s]*$/im, type: 'rule', template: 'User habit: $1' },
  { regex: /(?:记住|记得|别忘了)[:：]?\s*(.+?)[。！？，\s]*$/im, type: 'rule', template: '用户要求记住: $1' },
];

export interface ExtractedMemory {
  memoryType: string;
  content: string;
  importance: number;
}

/**
 * Extract potential memories from a user message
 */
export function extractMemories(message: string): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];

  for (const pattern of MEMORY_PATTERNS) {
    const match = message.match(pattern.regex);
    if (match && match[1]) {
      const content = pattern.template.replace('$1', match[1].trim());
      memories.push({
        memoryType: pattern.type,
        content,
        importance: pattern.type === 'rule' ? 0.9 : 0.7,
      });
    }
  }

  return memories;
}

/**
 * Extract memories using LLM analysis (for more nuanced extraction)
 * Only called for longer messages to save API costs
 */
export async function extractMemoriesWithLLM(
  message: string,
  assistantResponse: string
): Promise<ExtractedMemory[]> {
  try {
    const ai = await getAI();

    const prompt = `分析以下对话，提取需要长期记住的用户信息。只提取事实、偏好、规则、技能类信息，不提取一次性问题或闲聊内容。

对话:
用户: ${message}
助手: ${assistantResponse}

请以JSON格式返回提取的记忆，格式如下:
[{"memoryType": "fact|preference|skill|context|rule|event", "content": "描述", "importance": 0.5}]

要求:
- memoryType必须是fact/preference/skill/context/rule/event之一
- content必须简洁明确，以"用户"开头
- importance范围0.0-1.0，事实和规则0.8-1.0，偏好0.6-0.9，上下文0.3-0.6
- 如果没有需要记住的信息，返回空数组[]
- 只返回JSON，不要其他文字`;

    const completion = await ai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一个记忆提取助手。分析对话，提取用户的长期信息。只返回JSON数组，不要任何其他文字。',
        },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
    });

    const responseText =
      completion?.choices?.[0]?.message?.content ||
      completion?.content ||
      (typeof completion === 'string' ? completion : '');

    if (!responseText) return [];

    // Try to parse JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          item.memoryType &&
          item.content &&
          typeof item.importance === 'number' &&
          ['fact', 'preference', 'skill', 'context', 'rule', 'event'].includes(
            item.memoryType as string
          )
      )
      .map((item: Record<string, unknown>) => ({
        memoryType: item.memoryType as string,
        content: item.content as string,
        importance: Math.min(1, Math.max(0, item.importance as number)),
      }));
  } catch (error) {
    console.error('[AI] LLM memory extraction failed:', error);
    return [];
  }
}

/**
 * Check content similarity between two strings (simple Jaccard on chars)
 */
export function contentSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(''));
  const setB = new Set(b.toLowerCase().split(''));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Merge regex and LLM extracted memories, deduplicating by content similarity
 */
export function mergeExtractedMemories(
  regexMemories: ExtractedMemory[],
  llmMemories: ExtractedMemory[],
  similarityThreshold = 0.6
): ExtractedMemory[] {
  const merged = [...regexMemories];

  for (const llmMem of llmMemories) {
    const isDuplicate = merged.some(
      (existing) => contentSimilarity(existing.content, llmMem.content) >= similarityThreshold
    );
    if (!isDuplicate) {
      merged.push(llmMem);
    }
  }

  return merged;
}

/**
 * Search for relevant memories based on keywords in a message
 */
export function getRelevantKeywords(message: string): string[] {
  const stopWords = new Set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours',
    'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her',
    'it', 'its', 'they', 'them', 'their',
    'what', 'which', 'who', 'this', 'that', 'these', 'those',
    'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did',
    'a', 'an', 'the', 'and', 'but', 'if', 'or', 'as',
    'of', 'at', 'by', 'for', 'with', 'about',
    'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'then',
    'all', 'both', 'each', 'few', 'more', 'most',
    'some', 'such', 'no', 'not', 'only', 'so',
    'can', 'will', 'just', 'should', 'now',
    'would', 'could', 'might', 'also', 'really',
    'know', 'think', 'want', 'need', 'help',
    'please', 'thanks', 'thank', 'yes', 'no',
    // Chinese stop words
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
    '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
    '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
    '吗', '吧', '啊', '呢', '把', '那', '被', '让', '给', '对',
    '什么', '怎么', '如何', '为什么', '哪', '哪里', '什么时候',
    '可以', '能', '可能', '应该', '必须', '需要', '希望', '想要',
  ]);

  // Extract keywords from both Chinese and English
  const chineseChars = message.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const englishWords = message
    .toLowerCase()
    .replace(/[^a-z0-9\s\u4e00-\u9fff]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return [...new Set([...chineseChars, ...englishWords])];
}
