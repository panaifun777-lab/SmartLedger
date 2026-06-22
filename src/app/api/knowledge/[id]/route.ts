import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/knowledge/[id] - Get document details with chunks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const doc = await db.knowledgeDoc.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    })

    if (!doc) {
      return NextResponse.json(
        { error: '文档未找到' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      sourceUrl: doc.sourceUrl,
      content: doc.content,
      chunkCount: doc.chunkCount,
      status: doc.status,
      errorMessage: doc.errorMessage,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunks: doc.chunks.map(chunk => ({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        metadata: chunk.metadata,
        createdAt: chunk.createdAt,
      })),
    })
  } catch (error) {
    console.error('[Knowledge API] GET [id] error:', error)
    return NextResponse.json(
      { error: '获取文档详情失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge/[id] - Delete specific document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const doc = await db.knowledgeDoc.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json(
        { error: '文档未找到' },
        { status: 404 }
      )
    }

    // Delete document (cascades to chunks)
    await db.knowledgeDoc.delete({ where: { id } })

    return NextResponse.json({ message: '文档已删除' })
  } catch (error) {
    console.error('[Knowledge API] DELETE [id] error:', error)
    return NextResponse.json(
      { error: '删除文档失败' },
      { status: 500 }
    )
  }
}
