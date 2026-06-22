/**
 * Search utilities for RAG knowledge base.
 * Implements hybrid search combining keyword matching and semantic similarity.
 */

import { db } from '@/lib/db'
import {
  extractKeywords,
  parseKeywordVector,
  keywordSimilarity,
  generateKeywordVector,
} from './embedder'

export interface SearchResult {
  chunkId: string
  docId: string
  docTitle: string
  chunkIndex: number
  content: string
  score: number
  matchType: 'keyword' | 'semantic' | 'hybrid'
  metadata: Record<string, unknown>
}

/**
 * Keyword search using SQL LIKE queries.
 * Searches both chunk content and document titles.
 */
export async function keywordSearch(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const queryKeywords = extractKeywords(query)
  const queryTerms = [...queryKeywords.keys()]

  if (queryTerms.length === 0) return []

  // Build LIKE conditions for each keyword
  const chunks = await db.knowledgeChunk.findMany({
    where: {
      doc: { status: 'ready' },
    },
    include: {
      doc: {
        select: { id: true, title: true },
      },
    },
    take: 500, // Pre-filter for in-memory scoring
  })

  const results: SearchResult[] = []

  for (const chunk of chunks) {
    const contentLower = chunk.content.toLowerCase()
    const titleLower = chunk.doc.title.toLowerCase()

    let score = 0
    let matchedTerms = 0

    for (const term of queryTerms) {
      const termLower = term.toLowerCase()
      // Check chunk content
      if (contentLower.includes(termLower)) {
        score += queryKeywords.get(term) || 0.5
        matchedTerms++
      }
      // Bonus for title match
      if (titleLower.includes(termLower)) {
        score += 0.3
        matchedTerms++
      }
    }

    if (matchedTerms > 0) {
      results.push({
        chunkId: chunk.id,
        docId: chunk.docId,
        docTitle: chunk.doc.title,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score,
        matchType: 'keyword',
        metadata: { matchedTerms },
      })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

/**
 * Semantic search using keyword vector similarity.
 * Compares query's keyword vector against stored chunk vectors.
 */
export async function semanticSearch(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const queryVector = parseKeywordVector(generateKeywordVector(query))

  if (queryVector.length === 0) return []

  // Load all chunks with their keyword vectors
  const chunks = await db.knowledgeChunk.findMany({
    where: {
      doc: { status: 'ready' },
    },
    include: {
      doc: {
        select: { id: true, title: true },
      },
    },
  })

  const results: SearchResult[] = []

  for (const chunk of chunks) {
    let chunkVector: Array<[string, number]> = []

    try {
      const metadata = JSON.parse(chunk.metadata || '{}')
      if (metadata.keywordVector) {
        chunkVector = parseKeywordVector(metadata.keywordVector)
      }
    } catch {
      // Fallback: generate vector on the fly
      chunkVector = parseKeywordVector(generateKeywordVector(chunk.content))
    }

    // If no stored vector, generate from content
    if (chunkVector.length === 0) {
      chunkVector = parseKeywordVector(generateKeywordVector(chunk.content))
    }

    const similarity = keywordSimilarity(queryVector, chunkVector)

    if (similarity > 0.01) {
      results.push({
        chunkId: chunk.id,
        docId: chunk.docId,
        docTitle: chunk.doc.title,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: similarity,
        matchType: 'semantic',
        metadata: { similarity },
      })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}

/**
 * Hybrid search combining keyword and semantic search.
 * Merges results with weighted scoring.
 */
export async function hybridSearch(
  query: string,
  limit: number = 10,
  keywordWeight: number = 0.4,
  semanticWeight: number = 0.6
): Promise<SearchResult[]> {
  // Run both searches in parallel
  const [keywordResults, semanticResults] = await Promise.all([
    keywordSearch(query, limit * 2),
    semanticSearch(query, limit * 2),
  ])

  // Create a merged score map
  const scoreMap = new Map<string, SearchResult>()

  // Add keyword results
  for (const result of keywordResults) {
    const normalizedScore = result.score / (keywordResults[0]?.score || 1)
    scoreMap.set(result.chunkId, {
      ...result,
      score: normalizedScore * keywordWeight,
      matchType: 'keyword',
    })
  }

  // Merge semantic results
  for (const result of semanticResults) {
    const normalizedScore = result.score / (semanticResults[0]?.score || 1)
    const existing = scoreMap.get(result.chunkId)

    if (existing) {
      // Combine scores from both methods
      existing.score += normalizedScore * semanticWeight
      existing.matchType = 'hybrid'
    } else {
      scoreMap.set(result.chunkId, {
        ...result,
        score: normalizedScore * semanticWeight,
        matchType: 'semantic',
      })
    }
  }

  // Sort by combined score
  const results = [...scoreMap.values()]
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

/**
 * Quick search for RAG integration in chat.
 * Returns the most relevant chunks for a given query.
 */
export async function searchForRAG(
  query: string,
  topK: number = 5,
  threshold: number = 0.1
): Promise<Array<{ content: string; docTitle: string; score: number }>> {
  const results = await hybridSearch(query, topK)

  return results
    .filter(r => r.score >= threshold)
    .map(r => ({
      content: r.content,
      docTitle: r.docTitle,
      score: r.score,
    }))
}
