import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backfillEmbeddings } from '@/lib/memory-engine';

/**
 * POST /api/admin/backfill — batch generate embeddings for memories that don't have one.
 *
 * Query params:
 *   batchSize — number of memories to embed in one call (default 20, max 50)
 *
 * Uses ZHIPU embedding-2 API (DeepSeek doesn't offer embeddings).
 * Returns: { processed, embedded, failed, remaining }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const batchSize = Math.min(50, parseInt(url.searchParams.get('batchSize') || '20', 10));

    const result = await backfillEmbeddings(batchSize);

    // Check how many still need embedding
    const { db } = await import('@/lib/db');
    const remaining = await db.memoryItem.count({
      where: { embedding: null, status: 'active' },
    });

    return NextResponse.json({
      success: true,
      ...result,
      remaining,
      message: result.embedded > 0
        ? `已为 ${result.embedded} 条记忆生成 embedding,剩余 ${remaining} 条待处理`
        : `没有新记忆需要处理,剩余 ${remaining} 条无 embedding`,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}
