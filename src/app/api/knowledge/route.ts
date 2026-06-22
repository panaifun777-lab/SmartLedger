import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chunkText } from '@/lib/knowledge/chunker'
import { embedChunks, embedText } from '@/lib/knowledge/embedder'

export const dynamic = 'force-dynamic'

/**
 * GET /api/knowledge - List all knowledge documents with stats
 */
export async function GET() {
  try {
    const docs = await db.knowledgeDoc.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    })

    // Get total stats
    const totalDocs = await db.knowledgeDoc.count()
    const totalChunks = await db.knowledgeChunk.count()
    const readyDocs = await db.knowledgeDoc.count({ where: { status: 'ready' } })

    const result = docs.map(doc => ({
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      sourceUrl: doc.sourceUrl,
      content: doc.content,
      chunkCount: doc._count.chunks,
      status: doc.status,
      errorMessage: doc.errorMessage,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))

    return NextResponse.json({
      documents: result,
      stats: {
        totalDocs,
        totalChunks,
        readyDocs,
      },
    })
  } catch (error) {
    console.error('[Knowledge API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge documents' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/knowledge - Upload new document
 * Supports FormData (file upload) or JSON (text input)
 */
export async function POST(request: NextRequest) {
  try {
    let title: string
    let content: string
    let sourceType: string
    let sourceUrl: string | null = null

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const textInput = formData.get('text') as string | null

      if (file) {
        title = formData.get('title') as string || file.name
        sourceType = 'file'
        sourceUrl = (formData.get('sourceUrl') as string) || null

        // Read file content
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = file.name.split('.').pop()?.toLowerCase()

        if (ext === 'pdf') {
          // For PDF, we try to extract text but inform user if not possible
          // Basic text extraction attempt (PDFs are binary, so this is limited)
          const text = buffer.toString('utf-8')
          // Clean up PDF binary content - extract readable text portions
          const readableText = text
            .replace(/[^\x20-\x7E\u4e00-\u9fff\n\r]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          if (readableText.length < 50) {
            return NextResponse.json(
              { error: 'PDF文本提取受限。建议将PDF内容复制为纯文本后上传。' },
              { status: 400 }
            )
          }
          content = readableText
        } else {
          // Text-based files: .txt, .md, .json, .csv, etc.
          content = buffer.toString('utf-8')
        }
      } else if (textInput) {
        title = (formData.get('title') as string) || '文本输入'
        content = textInput
        sourceType = 'text'
      } else {
        return NextResponse.json(
          { error: 'No file or text provided' },
          { status: 400 }
        )
      }
    } else {
      // Handle JSON body
      const body = await request.json()
      title = body.title || '未命名文档'
      content = body.content
      sourceType = body.sourceType || 'text'
      sourceUrl = body.sourceUrl || null

      if (!content || content.trim().length === 0) {
        return NextResponse.json(
          { error: 'Content is required' },
          { status: 400 }
        )
      }
    }

    // Create document
    const doc = await db.knowledgeDoc.create({
      data: {
        title,
        sourceType,
        sourceUrl,
        content,
        status: 'processing',
      },
    })

    // Process chunks asynchronously
    processDocument(doc.id, content).catch(err => {
      console.error(`[Knowledge API] Error processing document ${doc.id}:`, err)
    })

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      status: 'processing',
      message: '文档已创建，正在处理中...',
    }, { status: 201 })
  } catch (error) {
    console.error('[Knowledge API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create knowledge document' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/knowledge - Delete a document by ID
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const doc = await db.knowledgeDoc.findUnique({ where: { id } })
    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Delete document (cascades to chunks)
    await db.knowledgeDoc.delete({ where: { id } })

    return NextResponse.json({ message: '文档已删除' })
  } catch (error) {
    console.error('[Knowledge API] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete knowledge document' },
      { status: 500 }
    )
  }
}

/**
 * Process a document: chunk it, generate embeddings, store in DB.
 */
async function processDocument(docId: string, content: string): Promise<void> {
  try {
    // 1. Chunk the text
    const chunks = chunkText(content)

    if (chunks.length === 0) {
      await db.knowledgeDoc.update({
        where: { id: docId },
        data: {
          status: 'error',
          errorMessage: '无法将文档分割为有效的片段',
        },
      })
      return
    }

    // 2. Generate keyword vectors for chunks (fast heuristic method)
    const keywordVectors = embedChunks(chunks.map(c => c.content))

    // 3. Store chunks in database
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const keywordVector = keywordVectors[i]

      await db.knowledgeChunk.create({
        data: {
          docId,
          chunkIndex: chunk.index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: JSON.stringify({
            ...chunk.metadata,
            keywordVector,
          }),
        },
      })
    }

    // 4. Update document status
    await db.knowledgeDoc.update({
      where: { id: docId },
      data: {
        chunkCount: chunks.length,
        status: 'ready',
      },
    })

    // 5. Asynchronously enhance embeddings with LLM (non-blocking)
    enhanceEmbeddingsAsync(docId, chunks).catch(err => {
      console.error(`[Knowledge API] LLM enhancement failed for ${docId}:`, err)
    })
  } catch (error) {
    console.error(`[Knowledge API] Processing error for ${docId}:`, error)
    await db.knowledgeDoc.update({
      where: { id: docId },
      data: {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '处理失败',
      },
    })
  }
}

/**
 * Enhance chunk embeddings with LLM-extracted keywords (async, non-blocking).
 */
async function enhanceEmbeddingsAsync(
  docId: string,
  chunks: Array<{ content: string; index: number }>
): Promise<void> {
  // Only enhance first 5 chunks with LLM to avoid rate limiting
  const chunksToEnhance = chunks.slice(0, 5)

  for (const chunk of chunksToEnhance) {
    try {
      const enhancedVector = await embedText(chunk.content)
      const existingChunk = await db.knowledgeChunk.findFirst({
        where: { docId, chunkIndex: chunk.index },
      })

      if (existingChunk) {
        const metadata = JSON.parse(existingChunk.metadata || '{}')
        await db.knowledgeChunk.update({
          where: { id: existingChunk.id },
          data: {
            metadata: JSON.stringify({
              ...metadata,
              keywordVector: enhancedVector,
            }),
          },
        })
      }
    } catch {
      // Skip on error, heuristic vector is still available
    }
  }
}
