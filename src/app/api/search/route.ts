import { NextRequest, NextResponse } from 'next/server';
import { getAI } from '@/lib/ai';

// POST /api/search - Search the web
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, num = 10, recency_days } = body as {
      query: string;
      num?: number;
      recency_days?: number;
    };

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and cannot be empty' },
        { status: 400 }
      );
    }

    const ai = await getAI();

    const searchArgs: { query: string; num?: number; recency_days?: number } = {
      query: query.trim(),
      num: Math.min(20, Math.max(1, num)),
    };

    if (recency_days) {
      searchArgs.recency_days = recency_days;
    }

    const results = await ai.functions.invoke('web_search', searchArgs);

    return NextResponse.json({
      results,
      query: query.trim(),
      count: results.length,
    });
  } catch (error) {
    console.error('Web search error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to perform web search';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
