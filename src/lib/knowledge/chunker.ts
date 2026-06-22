/**
 * Text chunking utilities for RAG knowledge base.
 * Splits documents into manageable chunks with overlap,
 * respecting paragraph, heading, and function boundaries.
 */

export interface Chunk {
  content: string
  index: number
  tokenCount?: number
  metadata: Record<string, unknown>
}

const DEFAULT_CHUNK_SIZE = 500
const DEFAULT_OVERLAP = 100

/**
 * Estimate token count for a string (rough: ~1.5 tokens per Chinese char, ~0.75 per English word)
 */
export function estimateTokenCount(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = text.replace(/[\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(w => w.length > 0).length
  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3)
}

/**
 * Split text into chunks with smart boundary detection.
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): Chunk[] {
  if (!text || text.trim().length === 0) return []

  // Detect content type and use appropriate chunker
  if (isMarkdown(text)) {
    return chunkMarkdown(text, chunkSize, overlap)
  }
  if (isCode(text)) {
    return chunkCode(text, chunkSize, overlap)
  }
  return chunkParagraphs(text, chunkSize, overlap)
}

/**
 * Check if text appears to be markdown
 */
function isMarkdown(text: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /^\*\s+/m,               // Unordered list
    /^\d+\.\s+/m,            // Ordered list
    /\[.*?\]\(.*?\)/,        // Links
    /```/,                   // Code blocks
    /^\|.*\|/m,              // Tables
    /^>\s+/m,                // Blockquotes
  ]
  let matchCount = 0
  for (const pattern of mdPatterns) {
    if (pattern.test(text)) matchCount++
  }
  return matchCount >= 2
}

/**
 * Check if text appears to be code
 */
function isCode(text: string): boolean {
  const codePatterns = [
    /^(function|class|const|let|var|import|export|def|async|await)\s+/m,
    /[{};]\s*$/m,
    /^\s*(public|private|protected)\s+/m,
  ]
  let matchCount = 0
  for (const pattern of codePatterns) {
    if (pattern.test(text)) matchCount++
  }
  return matchCount >= 2
}

/**
 * Chunk markdown text by headers first, then by size.
 */
function chunkMarkdown(text: string, chunkSize: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = []
  const lines = text.split('\n')

  // Split by headers
  const sections: Array<{ title: string; content: string }> = []
  let currentTitle = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headerMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n'),
        })
      }
      currentTitle = headerMatch[2]?.trim() || ''
      currentContent = [line]
    } else {
      currentContent.push(line)
    }
  }

  // Don't forget the last section
  if (currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n'),
    })
  }

  // Now chunk each section
  let chunkIndex = 0
  for (const section of sections) {
    const sectionText = section.content.trim()
    if (sectionText.length === 0) continue

    if (sectionText.length <= chunkSize) {
      chunks.push({
        content: sectionText,
        index: chunkIndex++,
        tokenCount: estimateTokenCount(sectionText),
        metadata: {
          source: 'markdown',
          header: section.title,
        },
      })
    } else {
      // Split large sections by paragraphs
      const subChunks = chunkParagraphs(sectionText, chunkSize, overlap)
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          index: chunkIndex++,
          metadata: {
            ...sub.metadata,
            source: 'markdown',
            header: section.title,
          },
        })
      }
    }
  }

  return chunks
}

/**
 * Chunk code by function/class boundaries.
 */
function chunkCode(text: string, chunkSize: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = []
  const lines = text.split('\n')

  // Try to split on function/class boundaries
  const boundaries: number[] = [0]
  const functionPattern = /^(export\s+)?(async\s+)?(function|class|const|let|var|def)\s+\w+/
  const methodPattern = /^\s*(public|private|protected|static|async)\s+\w+\s*[\(<]/

  for (let i = 0; i < lines.length; i++) {
    if (functionPattern.test(lines[i]) || methodPattern.test(lines[i])) {
      boundaries.push(i)
    }
  }

  // If very few boundaries, fall back to line-based chunking
  if (boundaries.length <= 2) {
    return chunkByLines(text, chunkSize, overlap, 'code')
  }

  // Create chunks between boundaries
  let chunkIndex = 0
  for (let b = 0; b < boundaries.length; b++) {
    const startLine = boundaries[b]
    const endLine = b + 1 < boundaries.length ? boundaries[b + 1] : lines.length
    const content = lines.slice(startLine, endLine).join('\n').trim()

    if (content.length === 0) continue

    if (content.length <= chunkSize) {
      chunks.push({
        content,
        index: chunkIndex++,
        tokenCount: estimateTokenCount(content),
        metadata: { source: 'code', startLine: startLine + 1, endLine },
      })
    } else {
      // Split oversized chunk by lines
      const subChunks = chunkByLines(content, chunkSize, overlap, 'code')
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          index: chunkIndex++,
          metadata: { ...sub.metadata, source: 'code', startLine: startLine + 1 },
        })
      }
    }
  }

  return chunks
}

/**
 * Chunk text by paragraphs with overlap.
 */
function chunkParagraphs(text: string, chunkSize: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = []
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)

  let currentContent = ''
  let chunkIndex = 0

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim()

    if (currentContent.length + para.length + 2 > chunkSize && currentContent.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentContent.trim(),
        index: chunkIndex++,
        tokenCount: estimateTokenCount(currentContent),
        metadata: { source: 'text' },
      })

      // Overlap: include last part of current content
      if (overlap > 0 && currentContent.length > overlap) {
        currentContent = currentContent.slice(-overlap) + '\n\n' + para
      } else {
        currentContent = para
      }
    } else {
      currentContent = currentContent ? currentContent + '\n\n' + para : para
    }
  }

  // Don't forget the last chunk
  if (currentContent.trim().length > 0) {
    chunks.push({
      content: currentContent.trim(),
      index: chunkIndex++,
      tokenCount: estimateTokenCount(currentContent),
      metadata: { source: 'text' },
    })
  }

  return chunks
}

/**
 * Chunk text by lines with overlap (used for code).
 */
function chunkByLines(text: string, chunkSize: number, overlap: number, sourceType: string): Chunk[] {
  const chunks: Chunk[] = []
  const lines = text.split('\n')
  const linesPerChunk = Math.max(1, Math.floor(chunkSize / 40)) // ~40 chars per line average
  const overlapLines = Math.max(0, Math.floor(overlap / 40))

  let chunkIndex = 0
  let i = 0

  while (i < lines.length) {
    const end = Math.min(i + linesPerChunk, lines.length)
    const content = lines.slice(i, end).join('\n').trim()

    if (content.length > 0) {
      chunks.push({
        content,
        index: chunkIndex++,
        tokenCount: estimateTokenCount(content),
        metadata: { source: sourceType, startLine: i + 1, endLine: end },
      })
    }

    i = end - overlapLines
    if (i <= end - linesPerChunk) i = end // Prevent infinite loop
  }

  return chunks
}
