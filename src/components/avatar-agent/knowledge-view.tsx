'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  FileText,
  Type,
  Link2,
  Upload,
  X,
  Clock,
  Loader2,
  ChevronRight,
  File,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Hash,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'

// Types
interface KnowledgeDoc {
  id: string
  title: string
  sourceType: string
  sourceUrl: string | null
  content: string
  chunkCount: number
  status: string
  errorMessage: string | null
  metadata: string
  createdAt: string
  updatedAt: string
}

interface KnowledgeChunk {
  id: string
  chunkIndex: number
  content: string
  tokenCount: number | null
  metadata: string
  createdAt: string
}

interface SearchResult {
  chunkId: string
  docId: string
  docTitle: string
  chunkIndex: number
  content: string
  score: number
  matchType: string
}

export function KnowledgeView() {
  const prefersReducedMotion = useReducedMotion()

  // State
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([])
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0, readyDocs: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Upload state
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('text')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadText, setUploadText] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Detail panel state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<{ doc: KnowledgeDoc; chunks: KnowledgeChunk[] } | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setDocuments(data.documents || [])
      setStats(data.stats || { totalDocs: 0, totalChunks: 0, readyDocs: 0 })
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Auto-refresh for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing')
    if (hasProcessing) {
      const timer = setTimeout(loadDocuments, 3000)
      return () => clearTimeout(timer)
    }
  }, [documents, loadDocuments])

  // Load document detail
  const loadDocDetail = useCallback(async (docId: string) => {
    setIsLoadingDetail(true)
    try {
      const res = await fetch(`/api/knowledge/${docId}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSelectedDoc({
        doc: {
          id: data.id,
          title: data.title,
          sourceType: data.sourceType,
          sourceUrl: data.sourceUrl,
          content: data.content || '',
          chunkCount: data.chunkCount,
          status: data.status,
          errorMessage: data.errorMessage,
          metadata: data.metadata,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
        chunks: data.chunks || [],
      })
    } catch (err) {
      console.error('Failed to load doc detail:', err)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDocId) {
      loadDocDetail(selectedDocId)
    }
  }, [selectedDocId, loadDocDetail])

  // Handle upload
  const handleUpload = async () => {
    setIsUploading(true)
    try {
      if (uploadMode === 'text') {
        if (!uploadText.trim()) return
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: uploadTitle.trim() || '文本输入',
            content: uploadText,
            sourceType: 'text',
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '上传失败')
        }
      } else if (uploadMode === 'file' && uploadFile) {
        const formData = new FormData()
        formData.append('file', uploadFile)
        if (uploadTitle.trim()) formData.append('title', uploadTitle.trim())
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '上传失败')
        }
      }

      // Reset and reload
      setShowUploadDialog(false)
      setUploadTitle('')
      setUploadText('')
      setUploadFile(null)
      await loadDocuments()
    } catch (err) {
      console.error('Upload failed:', err)
      alert(err instanceof Error ? err.message : '上传失败')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle delete
  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/knowledge/${docId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')

      if (selectedDocId === docId) {
        setSelectedDocId(null)
        setSelectedDoc(null)
      }
      setDeleteConfirmId(null)
      await loadDocuments()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setShowSearch(true)
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, topK: 5, mode: 'hybrid' }),
      })
      if (!res.ok) throw new Error('搜索失败')
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setUploadFile(file)
      setUploadTitle(file.name)
      setUploadMode('file')
      setShowUploadDialog(true)
    }
  }

  // Source type config
  const sourceTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    text: { icon: Type, label: '文本', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    file: { icon: File, label: '文件', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    url: { icon: Link2, label: '链接', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  }

  // Status config
  const statusConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    processing: { icon: Loader2, label: '处理中', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    ready: { icon: CheckCircle2, label: '就绪', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    error: { icon: AlertCircle, label: '错误', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  }

  return (
    <div
      className="flex h-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Main list */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">知识库</h2>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold px-2">
                {stats.totalDocs}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索知识..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 w-[200px] h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => { setSearchQuery(''); setShowSearch(false); setSearchResults([]) }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4" />
                  添加文档
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <DialogTitle>添加文档到知识库</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  {/* Upload mode tabs */}
                  <div className="flex gap-2">
                    <Button
                      variant={uploadMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadMode('text')}
                      className={cn(
                        'gap-1.5',
                        uploadMode === 'text' && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      )}
                    >
                      <Type className="h-4 w-4" />
                      文本输入
                    </Button>
                    <Button
                      variant={uploadMode === 'file' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadMode('file')}
                      className={cn(
                        'gap-1.5',
                        uploadMode === 'file' && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      )}
                    >
                      <Upload className="h-4 w-4" />
                      文件上传
                    </Button>
                  </div>

                  {/* Title */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">文档标题</label>
                    <Input
                      placeholder="输入文档标题（可选）"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                    />
                  </div>

                  {/* Text input mode */}
                  {uploadMode === 'text' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">文本内容</label>
                      <Textarea
                        placeholder="粘贴或输入要添加到知识库的文本内容..."
                        value={uploadText}
                        onChange={(e) => setUploadText(e.target.value)}
                        rows={8}
                        className="resize-y"
                      />
                      <p className="text-xs text-muted-foreground">
                        支持 Markdown 格式。内容将自动分割为多个片段进行索引。
                      </p>
                    </div>
                  )}

                  {/* File upload mode */}
                  {uploadMode === 'file' && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">选择文件</label>
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
                          uploadFile
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
                            : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:border-emerald-600'
                        )}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-8 w-8 text-emerald-600" />
                            <p className="text-sm font-medium">{uploadFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(uploadFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">点击选择文件或拖放文件</p>
                            <p className="text-xs text-muted-foreground/60">
                              支持 .txt, .md, .json, .csv, .pdf
                            </p>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".txt,.md,.json,.csv,.pdf,.markdown,.text"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setUploadFile(file)
                              if (!uploadTitle) setUploadTitle(file.name)
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={
                      isUploading ||
                      (uploadMode === 'text' ? !uploadText.trim() : !uploadFile)
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        上传中...
                      </>
                    ) : (
                      '上传文档'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>上次更新: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: zhCN })}</span>
            </div>
            <span className="text-muted-foreground/50">·</span>
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>{stats.totalChunks} 个片段</span>
            </div>
            <span className="text-muted-foreground/50">·</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>{stats.readyDocs} 个就绪</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-[11px] text-muted-foreground"
            onClick={loadDocuments}
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </Button>
        </div>

        {/* Search Results */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b overflow-hidden"
            >
              <div className="px-6 py-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4 text-emerald-600" />
                    搜索结果
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {searchResults.length}
                    </Badge>
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => { setShowSearch(false); setSearchResults([]) }}
                  >
                    关闭
                  </Button>
                </div>
                {isSearching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                    <span className="ml-2 text-sm text-muted-foreground">搜索中...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.chunkId}
                        className="rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedDocId(result.docId)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {result.docTitle}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                result.matchType === 'hybrid'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : result.matchType === 'semantic'
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              )}
                            >
                              {result.matchType === 'hybrid' ? '混合' : result.matchType === 'semantic' ? '语义' : '关键词'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              相关度: {Math.round(result.score * 100)}%
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {result.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    未找到相关内容
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-emerald-50/80 dark:bg-emerald-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-emerald-400">
              <Upload className="h-12 w-12 text-emerald-600" />
              <p className="text-lg font-medium text-emerald-700 dark:text-emerald-300">拖放文件到此处</p>
              <p className="text-sm text-muted-foreground">支持 .txt, .md, .json, .csv, .pdf</p>
            </div>
          </div>
        )}

        {/* Document List */}
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4 flex flex-col gap-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center py-20 gap-3"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={prefersReducedMotion ? {} : { scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BookOpen className="h-12 w-12 text-muted-foreground/30" />
              </motion.div>
              <p className="text-sm text-muted-foreground">知识库为空</p>
              <p className="text-xs text-muted-foreground/60">点击"添加文档"上传文档或输入文本</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
              {documents.map((doc, i) => {
                const sourceConfig = sourceTypeConfig[doc.sourceType] || sourceTypeConfig.text
                const statusConf = statusConfig[doc.status] || statusConfig.ready
                const SourceIcon = sourceConfig.icon
                const StatusIcon = statusConf.icon

                return (
                  <motion.div
                    key={doc.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: prefersReducedMotion ? 0 : i * 0.03 }}
                  >
                    <div
                      className={cn(
                        'glass-card rounded-xl border p-4 flex flex-col gap-3 transition-all duration-150 cursor-pointer',
                        'hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800',
                        selectedDocId === doc.id && 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20'
                      )}
                      onClick={() => setSelectedDocId(doc.id)}
                    >
                      {/* Title row */}
                      <div className="flex items-start gap-2">
                        <SourceIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold truncate">{doc.title}</h3>
                        </div>
                        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 shrink-0', statusConf.color)}>
                          <StatusIcon className={cn('h-3 w-3 mr-0.5', doc.status === 'processing' && 'animate-spin')} />
                          {statusConf.label}
                        </Badge>
                      </div>

                      {/* Source type badge */}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', sourceConfig.color)}>
                          {sourceConfig.label}
                        </Badge>
                        {doc.sourceUrl && (
                          <a
                            href={doc.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-muted-foreground hover:text-emerald-600 flex items-center gap-0.5 truncate max-w-[120px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            {doc.sourceUrl}
                          </a>
                        )}
                      </div>

                      {/* Chunk count */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        <span>{doc.chunkCount} 个片段</span>
                      </div>

                      {/* Error message */}
                      {doc.status === 'error' && doc.errorMessage && (
                        <Alert variant="destructive" className="py-2 px-3">
                          <AlertDescription className="text-[11px]">
                            {doc.errorMessage}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-auto pt-2 border-t">
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: zhCN })}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedDocId(doc.id)
                            }}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Dialog
                            open={deleteConfirmId === doc.id}
                            onOpenChange={(open) => !open && setDeleteConfirmId(null)}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirmId(doc.id)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <DialogContent onClick={(e) => e.stopPropagation()}>
                              <DialogHeader>
                                <DialogTitle>确认删除</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground py-2">
                                确定要删除文档「{doc.title}」吗？此操作不可撤销，所有相关片段也将被删除。
                              </p>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline" size="sm">取消</Button>
                                </DialogClose>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(doc.id)}
                                >
                                  删除
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      {selectedDocId && (
        <div className="w-[380px] shrink-0 border-l bg-background dark:bg-white/[0.02] dark:backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">文档详情</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setSelectedDocId(null)
                setSelectedDoc(null)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {isLoadingDetail ? (
            <div className="p-4 flex flex-col gap-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ) : selectedDoc ? (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 flex flex-col gap-4">
                {/* Title */}
                <div>
                  <h3 className="text-base font-semibold">{selectedDoc.doc.title}</h3>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-1">来源类型</p>
                    <Badge variant="secondary" className={cn(
                      'text-[10px] px-1.5 py-0',
                      (sourceTypeConfig[selectedDoc.doc.sourceType] || sourceTypeConfig.text).color
                    )}>
                      {(sourceTypeConfig[selectedDoc.doc.sourceType] || sourceTypeConfig.text).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">状态</p>
                    <Badge variant="secondary" className={cn(
                      'text-[10px] px-1.5 py-0',
                      (statusConfig[selectedDoc.doc.status] || statusConfig.ready).color
                    )}>
                      {(statusConfig[selectedDoc.doc.status] || statusConfig.ready).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">片段数</p>
                    <p>{selectedDoc.doc.chunkCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">创建时间</p>
                    <p>{formatDistanceToNow(new Date(selectedDoc.doc.createdAt), { addSuffix: true, locale: zhCN })}</p>
                  </div>
                </div>

                {/* Source URL */}
                {selectedDoc.doc.sourceUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">来源链接</p>
                    <a
                      href={selectedDoc.doc.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {selectedDoc.doc.sourceUrl}
                    </a>
                  </div>
                )}

                {/* Error message */}
                {selectedDoc.doc.errorMessage && (
                  <Alert variant="destructive" className="py-2 px-3">
                    <AlertDescription className="text-[11px]">
                      {selectedDoc.doc.errorMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Original content preview */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">原文预览</p>
                  <div className="rounded-lg bg-muted p-3 text-xs leading-relaxed max-h-40 overflow-y-auto">
                    {selectedDoc.doc.content.substring(0, 500)}
                    {selectedDoc.doc.content.length > 500 && '...'}
                  </div>
                </div>

                {/* Chunks */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    文档片段 ({selectedDoc.chunks.length})
                  </p>
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {selectedDoc.chunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="rounded-lg border p-3 text-xs hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-muted-foreground">
                            片段 #{chunk.chunkIndex + 1}
                          </span>
                          {chunk.tokenCount && (
                            <span className="text-[10px] text-muted-foreground/60">
                              ~{chunk.tokenCount} tokens
                            </span>
                          )}
                        </div>
                        <p className="text-foreground/80 line-clamp-3 leading-relaxed">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </div>
      )}
    </div>
  )
}
