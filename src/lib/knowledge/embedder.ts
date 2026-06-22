/**
 * Embedding utilities for RAG knowledge base.
 * 
 * Since z-ai-web-dev-sdk doesn't have a native embedding API,
 * we use a hybrid approach:
 * 1. Extract semantic keywords from text using NLP heuristics
 * 2. Use the LLM to enhance keyword extraction for better semantic understanding
 * 3. Store keyword vectors in chunk metadata for similarity computation
 */

import { getAI } from '@/lib/ai'

/**
 * Chinese stop words for keyword extraction
 */
const CHINESE_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
  '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
  '吗', '吧', '啊', '呢', '把', '那', '被', '让', '给', '对',
  '什么', '怎么', '如何', '为什么', '哪', '哪里', '什么时候',
  '可以', '能', '可能', '应该', '必须', '需要', '希望', '想要',
  '还', '又', '与', '及', '等', '之', '其', '而', '或', '但',
  '如果', '因为', '所以', '虽然', '但是', '不过', '然后', '这样',
  '那样', '这个', '那个', '些', '个', '种', '每', '各', '该',
  '此', '些', '时', '中', '里', '外', '后', '前', '下', '内',
  '进行', '通过', '使用', '关于', '以及', '为了', '由于', '基于',
])

/**
 * English stop words
 */
const ENGLISH_STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'what', 'which', 'who', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can',
  'a', 'an', 'the', 'and', 'but', 'if', 'or', 'as', 'of',
  'at', 'by', 'for', 'with', 'about', 'to', 'from', 'up',
  'down', 'in', 'out', 'on', 'off', 'over', 'under', 'then',
  'all', 'both', 'each', 'few', 'more', 'most', 'some', 'such',
  'no', 'not', 'only', 'so', 'than', 'too', 'very', 'just',
  'also', 'really', 'know', 'think', 'want', 'need', 'help',
  'please', 'thanks', 'thank', 'yes', 'get', 'got', 'make',
])

/**
 * Extract semantic keywords from text using NLP heuristics.
 * Returns a map of keyword -> weight (TF-based).
 */
export function extractKeywords(text: string): Map<string, number> {
  const keywords = new Map<string, number>()

  // Extract Chinese phrases (2-4 chars)
  const chinesePhrases = text.match(/[\u4e00-\u9fff]{2,4}/g) || []
  for (const phrase of chinesePhrases) {
    if (!CHINESE_STOP_WORDS.has(phrase)) {
      keywords.set(phrase, (keywords.get(phrase) || 0) + 1)
    }
  }

  // Extract English words
  const englishWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !ENGLISH_STOP_WORDS.has(word))

  for (const word of englishWords) {
    keywords.set(word, (keywords.get(word) || 0) + 1)
  }

  // Extract bigrams for better semantic meaning
  const englishBigrams: string[] = []
  for (let i = 0; i < englishWords.length - 1; i++) {
    const bigram = `${englishWords[i]} ${englishWords[i + 1]}`
    englishBigrams.push(bigram)
    keywords.set(bigram, (keywords.get(bigram) || 0) + 0.5)
  }

  // Normalize weights
  const maxWeight = Math.max(...keywords.values(), 1)
  for (const [key, val] of keywords) {
    keywords.set(key, val / maxWeight)
  }

  return keywords
}

/**
 * Generate a compact keyword vector representation for a text.
 * This serves as a lightweight "embedding" for similarity computation.
 */
export function generateKeywordVector(text: string): string {
  const keywords = extractKeywords(text)
  // Keep top 30 keywords by weight
  const sorted = [...keywords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  return JSON.stringify(sorted)
}

/**
 * Parse keyword vector from JSON string.
 */
export function parseKeywordVector(json: string): Array<[string, number]> {
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}

/**
 * Compute keyword-based similarity between two keyword vectors.
 * Uses Jaccard-like overlap with weight consideration.
 */
export function keywordSimilarity(
  vecA: Array<[string, number]>,
  vecB: Array<[string, number]>
): number {
  if (vecA.length === 0 || vecB.length === 0) return 0

  const mapA = new Map(vecA)
  const mapB = new Map(vecB)

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const [key, weightA] of mapA) {
    normA += weightA * weightA
    if (mapB.has(key)) {
      dotProduct += weightA * (mapB.get(key) || 0)
    }
  }

  for (const [, weightB] of mapB) {
    normB += weightB * weightB
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Use LLM to enhance keyword extraction for better semantic understanding.
 * This generates a list of key concepts/topics from the text.
 */
export async function llmExtractKeywords(text: string): Promise<string[]> {
  try {
    const ai = await getAI()
    const response = await ai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一个文本分析助手。请从给定文本中提取5-15个关键概念或主题词，只返回词语列表，用逗号分隔，不要其他内容。',
        },
        {
          role: 'user',
          content: text.substring(0, 1000),
        },
      ],
      thinking: { type: 'disabled' },
    })

    const content = response?.choices?.[0]?.message?.content || ''
    // Parse comma-separated keywords
    const keywords = content
      .split(/[,，、\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0 && k.length <= 20)
    return keywords
  } catch (error) {
    console.error('[Embedder] LLM keyword extraction failed:', error)
    return []
  }
}

/**
 * Generate an enhanced keyword vector using both heuristic and LLM extraction.
 * This is the primary function for creating "embeddings" during document processing.
 */
export async function embedText(text: string): Promise<string> {
  // Start with heuristic keywords
  const heuristicKeywords = extractKeywords(text)

  // Enhance with LLM-extracted keywords
  try {
    const llmKeywords = await llmExtractKeywords(text)
    for (const kw of llmKeywords) {
      // Add LLM keywords with a moderate weight
      const existing = heuristicKeywords.get(kw) || 0
      heuristicKeywords.set(kw, existing + 0.8)
    }
  } catch {
    // Fall back to heuristic-only
  }

  // Keep top 30 keywords by weight
  const sorted = [...heuristicKeywords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
  return JSON.stringify(sorted)
}

/**
 * Batch embed multiple texts. Processes sequentially to avoid rate limiting.
 */
export async function embedChunks(texts: string[]): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < texts.length; i++) {
    // For batch processing, use heuristic-only (faster)
    // LLM enhancement can be done asynchronously later
    results.push(generateKeywordVector(texts[i]))
  }
  return results
}

/**
 * Compute cosine similarity between two number vectors.
 * (Used for future true vector embeddings)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
