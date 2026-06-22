import { NextRequest, NextResponse } from 'next/server'
import { hybridSearch, keywordSearch, semanticSearch, searchForRAG } from '@/lib/knowledge/searcher'

export const dynamic = 'force-dynamic'

/**
 * POST /api/knowledge/search - Search knowledge base
 * Body: { query: string, topK?: number, threshold?: number, mode?: 'hybrid' | 'keyword' | 'semantic' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, topK = 5, threshold = 0.05, mode = 'hybrid' } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: '搜索查询不能为空' },
        { status: 400 }
      )
    }

    let results

    switch (mode) {
      case 'keyword':
        results = await keywordSearch(query, topK)
        break
      case 'semantic':
        results = await semanticSearch(query, topK)
        break
      case 'rag':
        // RAG mode returns simplified results for chat integration
        const ragResults = await searchForRAG(query, topK, threshold)
        return NextResponse.json({
          results: ragResults,
          query,
          count: ragResults.length,
        })
      case 'hybrid':
      default:
        results = await hybridSearch(query, topK)
        break
    }

    return NextResponse.json({
      results,
      query,
      count: results.length,
    })
  } catch (error) {
    console.error('[Knowledge Search API] POST error:', error)
    return NextResponse.json(
      { error: '搜索失败' },
      { status: 500 }
    )
  }
}
