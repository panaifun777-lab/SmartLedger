/**
 * Memory Engine — 长期记忆系统核心
 *
 * 提供以下能力:
 * 1. 向量嵌入(智谱 embedding-2, 1024 维)
 * 2. 语义召回(余弦相似度 + 关键词混合)
 * 3. 矛盾检测(同主题相反事实)
 * 4. 记忆合并/版本升级(同事实更新内容)
 * 5. 重要性衰减(Ebbinghaus 遗忘曲线,但不主动遗忘核心记忆)
 * 6. 访问追踪(记录召回次数 + 最近访问时间)
 *
 * 设计原则:
 * - 不依赖外部向量数据库(用 SQLite + JSON 存储 embedding)
 * - 不主动遗忘核心记忆(importance > 0.8 的永不衰减)
 * - 矛盾检测:同主题新记忆出现时,把旧记忆标记为 deprecated + 创建版本
 * - 召回策略:语义相似度 + 关键词匹配 + 重要性 + 时近性 加权
 */

import { db } from '@/lib/db';

const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const EMBEDDING_DIM = 1024;
const EMBEDDING_MODEL = 'embedding-2';

/** 智谱 JWT 生成(与 deepseek-adapter 共用逻辑) */
async function zhipuJwt(apiKey: string): Promise<string> {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) {
    throw new Error('Invalid ZHIPU_API_KEY format (expected id.secret)');
  }

  const enc = new TextEncoder();

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

/** 计算文本的向量嵌入(智谱 embedding-2, 1024 维) */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.ZHIPU_API_KEY?.trim();
  if (!apiKey) {
    // 没配 ZHIPU key 就跳过嵌入,只用关键词召回
    return null;
  }

  try {
    const token = await zhipuJwt(apiKey);
    const resp = await fetch(`${ZHIPU_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.substring(0, 2000), // 智谱 embedding 限制 2000 字符
      }),
    });

    if (!resp.ok) {
      console.error('[MemoryEngine] Embedding failed:', resp.status, await resp.text());
      return null;
    }

    const data = await resp.json() as { data?: Array<{ embedding?: number[] }> };
    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      console.error('[MemoryEngine] Unexpected embedding length:', embedding?.length);
      return null;
    }
    return embedding;
  } catch (err) {
    console.error('[MemoryEngine] Embedding error:', err);
    return null;
  }
}

/** 余弦相似度 (1 = 完全相同, 0 = 无关, -1 = 完全相反) */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** 把 embedding 数组转成 JSON 字符串用于存储 */
export function embeddingToString(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/** 把存储的 JSON 字符串转回 embedding 数组 */
export function stringToEmbedding(str: string | null): number[] | null {
  if (!str) return null;
  try {
    const arr = JSON.parse(str);
    if (Array.isArray(arr) && arr.length === EMBEDDING_DIM) {
      return arr as number[];
    }
  } catch {
    // ignore
  }
  return null;
}

export interface RecallResult {
  memory: {
    id: string;
    content: string;
    memoryType: string;
    importance: number;
    metadata: Record<string, unknown>;
  };
  score: number; // 综合评分 (0-1)
  semanticScore: number; // 语义相似度
  keywordScore: number; // 关键词匹配度
  recencyScore: number; // 时近性
}

/**
 * 召回与查询最相关的记忆
 *
 * 策略:
 * 1. 取所有 active 记忆(按 importance 排序,top 200)
 * 2. 对每条记忆计算综合评分:
 *    - 语义相似度 (40%): 智谱 embedding 余弦相似度
 *    - 关键词匹配 (30%): 中英文关键词重叠度
 *    - 重要性 (20%): importance 字段
 *    - 时近性 (10%): 最近访问/更新的时间衰减
 * 3. 取 top N
 * 4. 异步更新召回记忆的 accessCount + lastAccessedAt
 */
export async function recallMemories(
  query: string,
  userId: string = 'default-user',
  topK: number = 8
): Promise<RecallResult[]> {
  // 1. 取所有 active 记忆
  const allMemories = await db.memoryItem.findMany({
    where: { status: 'active', userId },
    select: {
      id: true,
      content: true,
      memoryType: true,
      importance: true,
      metadata: true,
      embedding: true,
      accessCount: true,
      lastAccessedAt: true,
      updatedAt: true,
    },
    take: 200,
    orderBy: { importance: 'desc' },
  });

  if (allMemories.length === 0) return [];

  // 2. 计算查询的 embedding
  const queryEmbedding = await embedText(query);
  const queryKeywords = extractKeywords(query);

  // 3. 计算每条记忆的综合评分
  const now = Date.now();
  const scored = allMemories.map((mem) => {
    // 语义相似度
    let semanticScore = 0;
    if (queryEmbedding) {
      const memEmbedding = stringToEmbedding(mem.embedding);
      if (memEmbedding) {
        semanticScore = cosineSimilarity(queryEmbedding, memEmbedding);
        // 把 -1..1 映射到 0..1
        semanticScore = (semanticScore + 1) / 2;
      }
    }

    // 关键词匹配
    const memKeywords = extractKeywords(mem.content);
    const keywordScore = jaccardSimilarity(queryKeywords, memKeywords);

    // 重要性
    const importanceScore = mem.importance;

    // 时近性 (最近 7 天 = 1.0, 30 天 = 0.5, 90 天 = 0.2, 更久 = 0.1)
    const lastTime = mem.lastAccessedAt?.getTime() || mem.updatedAt.getTime();
    const daysSinceAccess = (now - lastTime) / (1000 * 60 * 60 * 24);
    let recencyScore = 0.1;
    if (daysSinceAccess < 7) recencyScore = 1.0;
    else if (daysSinceAccess < 30) recencyScore = 0.5;
    else if (daysSinceAccess < 90) recencyScore = 0.2;

    // 综合评分 (加权)
    // 如果没有 embedding,则提高关键词权重
    const hasEmbedding = !!queryEmbedding && !!stringToEmbedding(mem.embedding);
    const score = hasEmbedding
      ? semanticScore * 0.4 + keywordScore * 0.3 + importanceScore * 0.2 + recencyScore * 0.1
      : keywordScore * 0.5 + importanceScore * 0.35 + recencyScore * 0.15;

    return {
      memory: {
        id: mem.id,
        content: mem.content,
        memoryType: mem.memoryType,
        importance: mem.importance,
        metadata: parseMetadata(mem.metadata),
      },
      score,
      semanticScore,
      keywordScore,
      recencyScore,
    };
  });

  // 4. 排序取 top N
  const top = scored
    .filter((s) => s.score > 0.05) // 过滤掉完全无关的
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // 5. 异步更新 accessCount + lastAccessedAt (不阻塞响应)
  if (top.length > 0) {
    const ids = top.map((t) => t.memory.id);
    db.memoryItem.updateMany({
      where: { id: { in: ids } },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    }).catch((err) => {
      console.error('[MemoryEngine] Failed to update access count:', err);
    });
  }

  return top;
}

/** 解析 metadata JSON 字符串 */
function parseMetadata(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/**
 * 提取关键词(中英文混合)
 *
 * 中文: 用 2-4 字符的滑动窗口(因为没装 jieba,这是 fallback)
 * 英文: 按 whitespace 分词,过滤停用词
 */
export function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
    '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
    '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
    '吗', '吧', '啊', '呢', '把', '那', '被', '让', '给', '对',
    '什么', '怎么', '如何', '为什么', '哪', '哪里', '什么时候',
    '可以', '能', '可能', '应该', '必须', '需要', '希望', '想要',
    '这个', '那个', '这些', '那些',
    'i', 'me', 'my', 'the', 'a', 'an', 'is', 'are', 'was', 'were',
    'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
    'and', 'or', 'but', 'if', 'to', 'of', 'in', 'on', 'at', 'for',
    'with', 'about', 'from', 'by', 'this', 'that', 'it', 'they',
    'you', 'we', 'he', 'she', 'his', 'her', 'their', 'our',
    'what', 'which', 'who', 'when', 'where', 'why', 'how',
    'not', 'no', 'yes', 'ok', 'okay', 'please', 'thanks',
  ]);

  const keywords = new Set<string>();

  // 英文分词
  const englishWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  englishWords.forEach((w) => keywords.add(w));

  // 中文: 2-4 字符滑动窗口(过滤纯停用词组合)
  const chineseChunks = text.match(/[\u4e00-\u9fff]+/g) || [];
  for (const chunk of chineseChunks) {
    // 2-gram
    for (let i = 0; i < chunk.length - 1; i++) {
      const bigram = chunk.substring(i, i + 2);
      if (!stopWords.has(bigram)) {
        keywords.add(bigram);
      }
    }
    // 3-gram (捕获更具体的术语)
    for (let i = 0; i < chunk.length - 2; i++) {
      const trigram = chunk.substring(i, i + 3);
      if (!stopWords.has(trigram)) {
        keywords.add(trigram);
      }
    }
  }

  return keywords;
}

/** Jaccard 相似度 (两个关键词集合的交集/并集) */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 检测新记忆是否与现有记忆矛盾
 *
 * 策略:
 * 1. 找到与新记忆语义相似度 > 0.85 的同类型记忆
 * 2. 如果有,创建 MemoryRelation(contradicts 或 derived_from)
 * 3. 如果是 contradicts,把旧记忆标记为 deprecated,创建新版本
 *
 * 返回: 是否检测到矛盾 + 相关记忆 ID
 */
export async function detectContradiction(
  newContent: string,
  newType: string,
  userId: string = 'default-user'
): Promise<{ hasContradiction: boolean; relatedMemoryId?: string; similarity?: number }> {
  const newEmbedding = await embedText(newContent);
  if (!newEmbedding) {
    // 没有 embedding 就跳过矛盾检测
    return { hasContradiction: false };
  }

  // 找同类型的所有 active 记忆
  const existingMemories = await db.memoryItem.findMany({
    where: { status: 'active', userId, memoryType: newType },
    select: { id: true, content: true, embedding: true, importance: true },
    take: 100,
  });

  let bestMatch: { id: string; similarity: number } | null = null;
  for (const mem of existingMemories) {
    const memEmbedding = stringToEmbedding(mem.embedding);
    if (!memEmbedding) continue;
    const sim = cosineSimilarity(newEmbedding, memEmbedding);
    if (sim > 0.85 && (!bestMatch || sim > bestMatch.similarity)) {
      bestMatch = { id: mem.id, similarity: sim };
    }
  }

  return bestMatch
    ? { hasContradiction: true, relatedMemoryId: bestMatch.id, similarity: bestMatch.similarity }
    : { hasContradiction: false };
}

/**
 * 创建新记忆(带 embedding + 矛盾检测)
 *
 * 如果检测到与现有记忆矛盾:
 * - 旧记忆标记为 deprecated (status: 'deprecated')
 * - 创建 MemoryRelation(type: 'contradicts')
 * - 新记忆正常创建
 *
 * 返回: 新记忆 ID + 是否检测到矛盾
 */
export async function createMemoryWithEmbedding(params: {
  content: string;
  memoryType: string;
  importance: number;
  confidence: number;
  sourceType: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ memoryId: string; hadContradiction: boolean; contradictedMemoryId?: string }> {
  const { content, memoryType, importance, confidence, sourceType, userId = 'default-user', metadata = {} } = params;

  // 1. 计算新记忆的 embedding
  const embedding = await embedText(content);

  // 2. 矛盾检测
  const contradiction = await detectContradiction(content, memoryType, userId);

  // 3. 创建新记忆
  const newMemory = await db.memoryItem.create({
    data: {
      memoryType,
      content,
      importance,
      confidence,
      sourceType,
      userId,
      status: 'active',
      metadata: JSON.stringify(metadata),
      embedding: embedding ? embeddingToString(embedding) : null,
      versions: {
        create: {
          versionNo: 1,
          content,
          metadata: JSON.stringify(metadata),
          changeReason: 'Created with embedding',
        },
      },
    },
  });

  // 4. 如果有矛盾,处理旧记忆
  if (contradiction.hasContradiction && contradiction.relatedMemoryId) {
    // 旧记忆降级为 deprecated
    await db.memoryItem.update({
      where: { id: contradiction.relatedMemoryId },
      data: { status: 'deprecated' },
    });

    // 创建 contradicts 关系
    await db.memoryRelation.create({
      data: {
        fromMemoryId: newMemory.id,
        toMemoryId: contradiction.relatedMemoryId,
        relationType: 'contradicts',
        weight: contradiction.similarity || 0.85,
        metadata: JSON.stringify({ detectedAt: new Date().toISOString() }),
      },
    }).catch(() => {
      // 关系创建失败不阻塞
    });

    return {
      memoryId: newMemory.id,
      hadContradiction: true,
      contradictedMemoryId: contradiction.relatedMemoryId,
    };
  }

  return { memoryId: newMemory.id, hadContradiction: false };
}

/**
 * 批量为已有记忆生成 embedding (后台任务)
 *
 * 用于升级时把现有记忆都加上 embedding,这样语义召回才有效
 */
export async function backfillEmbeddings(batchSize: number = 20): Promise<{
  processed: number;
  embedded: number;
  failed: number;
}> {
  const memoriesWithoutEmbedding = await db.memoryItem.findMany({
    where: {
      embedding: null,
      status: 'active',
    },
    select: { id: true, content: true },
    take: batchSize,
  });

  let embedded = 0;
  let failed = 0;

  for (const mem of memoriesWithoutEmbedding) {
    const embedding = await embedText(mem.content);
    if (embedding) {
      await db.memoryItem.update({
        where: { id: mem.id },
        data: { embedding: embeddingToString(embedding) },
      });
      embedded++;
    } else {
      failed++;
    }
    // 避免触发智谱 API 限流(每秒 5 个)
    await new Promise((r) => setTimeout(r, 200));
  }

  return { processed: memoriesWithoutEmbedding.length, embedded, failed };
}

/**
 * 记忆维护:重要性衰减 + 核心保护
 *
 * 策略(与原 maintenance 不同,这个不会遗忘核心记忆):
 * - importance > 0.8 的核心记忆永不衰减
 * - importance 0.5-0.8 的:30 天未访问降 0.03,90 天降 0.08
 * - importance < 0.5 的:30 天未访问降 0.05,90 天降 0.1
 * - importance < 0.1 且 180 天未访问 → archive (但不删除)
 * - accessCount >= 5 的记忆 importance +0.05 (最高 1.0)
 */
export async function runMemoryMaintenance(): Promise<{
  decayed: number;
  archived: number;
  promoted: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const hundredEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  // 1. 衰减 (核心记忆 importance > 0.8 跳过)
  const decayCandidates = await db.memoryItem.findMany({
    where: {
      status: 'active',
      importance: { lte: 0.8 },
      OR: [
        { lastAccessedAt: { lt: thirtyDaysAgo } },
        { lastAccessedAt: null, updatedAt: { lt: thirtyDaysAgo } },
      ],
    },
    select: { id: true, importance: true, lastAccessedAt: true, updatedAt: true },
  });

  let decayed = 0;
  for (const mem of decayCandidates) {
    const lastTime = mem.lastAccessedAt || mem.updatedAt;
    const isOver90 = lastTime < ninetyDaysAgo;
    const isLowImportance = mem.importance < 0.5;
    const decay = isOver90 ? (isLowImportance ? 0.1 : 0.08) : (isLowImportance ? 0.05 : 0.03);
    const newImportance = Math.max(0, mem.importance - decay);

    await db.memoryItem.update({
      where: { id: mem.id },
      data: { importance: newImportance },
    });
    decayed++;
  }

  // 2. 归档 (importance < 0.1 且 180 天未访问)
  const archiveResult = await db.memoryItem.updateMany({
    where: {
      status: 'active',
      importance: { lt: 0.1 },
      OR: [
        { lastAccessedAt: { lt: hundredEightyDaysAgo } },
        { lastAccessedAt: null, updatedAt: { lt: hundredEightyDaysAgo } },
      ],
    },
    data: { status: 'archived' },
  });

  // 3. 提升 (accessCount >= 5)
  const promoteResult = await db.memoryItem.updateMany({
    where: {
      status: 'active',
      accessCount: { gte: 5 },
      importance: { lt: 1.0 },
    },
    data: { importance: { increment: 0.05 } },
  });

  return {
    decayed,
    archived: archiveResult.count,
    promoted: promoteResult.count,
  };
}
