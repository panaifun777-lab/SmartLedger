'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useMemoryStore, useAgentStore, type MemoryType, type MemoryItem } from '@/stores'
import { MemoryCard } from './memory-card'
import { MemoryGraph } from './memory-graph'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Search,
  Brain,
  X,
  ChevronRight,
  Clock,
  GitBranch,
  FileJson,
  Loader2,
  RefreshCw,
  List,
  Network,
  User,
  Sparkles,
  Code2,
  Server,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion, useReducedMotion } from 'framer-motion'

const filterPills: { type: MemoryType | 'all'; label: string }[] = [
  { type: 'all', label: '全部' },
  { type: 'fact', label: '事实' },
  { type: 'preference', label: '偏好' },
  { type: 'skill', label: '技能' },
  { type: 'context', label: '上下文' },
  { type: 'rule', label: '规则' },
  { type: 'event', label: '事件' },
]

const pillColors: Record<string, string> = {
  all: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  fact: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  preference: 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  skill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  context: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  rule: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  event: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
}

export function MemoryView() {
  const prefersReducedMotion = useReducedMotion()
  const {
    memories,
    selectedMemoryId,
    searchQuery,
    filterType,
    filterStatus,
    isLoading,
    memoryVersions,
    memoryRelations,
    setMemories,
    addMemory,
    setSelectedMemoryId,
    setSearchQuery,
    setFilterType,
    loadMemories,
    createMemory,
    selectMemory,
  } = useMemoryStore()

  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [profileData, setProfileData] = useState<{
    isSeeded: boolean
    seededCount: number
    totalSeedItems: number
    typeCounts: Record<string, number>
  } | null>(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const [newMemory, setNewMemory] = useState<{
    content: string;
    memoryType: MemoryType;
    importance: number;
    confidence: number;
    sourceType: 'chat' | 'api' | 'file' | 'tool' | 'manual';
  }>({
    content: '',
    memoryType: 'fact',
    importance: 0.5,
    confidence: 0.8,
    sourceType: 'manual',
  })

  // Load memories from API on mount
  useEffect(() => {
    loadMemories().then(() => setLastUpdated(new Date()))
    // Also load seed profile status
    fetch('/api/memory/seed')
      .then((res) => res.json())
      .then((data) => setProfileData(data))
      .catch(() => {})
  }, [loadMemories])

  // Sync sidebar memoryTypeFilter → memory store filterType.
  // When the user clicks a category in the sidebar, the agent store sets
  // memoryTypeFilter. We apply it to the memory store's filterType so the
  // pill bar and filtered list stay in sync.
  const memoryTypeFilter = useAgentStore((s) => s.memoryTypeFilter)
  useEffect(() => {
    if (memoryTypeFilter && memoryTypeFilter !== 'all') {
      setFilterType(memoryTypeFilter)
    } else if (memoryTypeFilter === 'all') {
      setFilterType('all')
    }
  }, [memoryTypeFilter, setFilterType])

  // Load versions and relations when a memory is selected
  useEffect(() => {
    if (selectedMemoryId) {
      selectMemory(selectedMemoryId)
    }
  }, [selectedMemoryId, selectMemory])

  const filteredMemories = useMemo(() => {
    let result = memories
    if (filterType !== 'all') {
      result = result.filter((m) => m.memoryType === filterType)
    }
    if (filterStatus !== 'all') {
      result = result.filter((m) => m.status === filterStatus)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.content.toLowerCase().includes(q) ||
          m.memoryType.toLowerCase().includes(q)
      )
    }
    return result.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [memories, filterType, filterStatus, searchQuery])

  const selectedMemory = memories.find((m) => m.id === selectedMemoryId)

  const handleAddMemory = async () => {
    if (!newMemory.content.trim()) return
    setIsCreating(true)
    try {
      await createMemory({
        memoryType: newMemory.memoryType,
        content: newMemory.content,
        importance: newMemory.importance,
        confidence: newMemory.confidence,
        sourceType: newMemory.sourceType,
      })
      setShowAddDialog(false)
      setNewMemory({
        content: '',
        memoryType: 'fact',
        importance: 0.5,
        confidence: 0.8,
        sourceType: 'manual',
      })
      setLastUpdated(new Date())
    } catch {
      // Error already handled in store
    } finally {
      setIsCreating(false)
    }
  }

  const handleRefresh = async () => {
    await loadMemories()
    setLastUpdated(new Date())
    // Also refresh profile status
    try {
      const res = await fetch('/api/memory/seed')
      if (res.ok) {
        const data = await res.json()
        setProfileData(data)
      }
    } catch {
      // ignore
    }
  }

  const handleSeedProfile = useCallback(async () => {
    setIsSeeding(true)
    try {
      const res = await fetch('/api/memory/seed', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setProfileData({
          isSeeded: true,
          seededCount: data.seeded,
          totalSeedItems: data.total,
          typeCounts: data.typeCounts,
        })
        await loadMemories()
        setLastUpdated(new Date())
      }
    } catch {
      // error handled silently
    } finally {
      setIsSeeding(false)
    }
  }, [loadMemories])

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">记忆库</h2>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold px-2">
                {memories.length}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('h-7 gap-1.5 text-xs px-2.5', viewMode === 'list' && 'shadow-sm')}
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5" />
                列表
              </Button>
              <Button
                variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('h-7 gap-1.5 text-xs px-2.5', viewMode === 'graph' && 'shadow-sm')}
                onClick={() => setViewMode('graph')}
              >
                <Network className="h-3.5 w-3.5" />
                图谱
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索记忆..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px] h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4" />
                  添加记忆
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加新记忆</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label>记忆内容</Label>
                    <Textarea
                      value={newMemory.content}
                      onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                      placeholder="输入记忆内容..."
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>类型</Label>
                      <Select
                        value={newMemory.memoryType}
                        onValueChange={(v) =>
                          setNewMemory({ ...newMemory, memoryType: v as MemoryType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fact">事实</SelectItem>
                          <SelectItem value="preference">偏好</SelectItem>
                          <SelectItem value="skill">技能</SelectItem>
                          <SelectItem value="context">上下文</SelectItem>
                          <SelectItem value="rule">规则</SelectItem>
                          <SelectItem value="event">事件</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>来源</Label>
                      <Select
                        value={newMemory.sourceType}
                        onValueChange={(v) =>
                          setNewMemory({ ...newMemory, sourceType: v as 'chat' | 'api' | 'file' | 'tool' | 'manual' })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">手动</SelectItem>
                          <SelectItem value="chat">对话</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="file">文件</SelectItem>
                          <SelectItem value="tool">工具</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>重要性: {Math.round(newMemory.importance * 100)}%</Label>
                    <Slider
                      value={[newMemory.importance * 100]}
                      onValueChange={([v]) =>
                        setNewMemory({ ...newMemory, importance: v / 100 })
                      }
                      max={100}
                      step={5}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>置信度: {Math.round(newMemory.confidence * 100)}%</Label>
                    <Slider
                      value={[newMemory.confidence * 100]}
                      onValueChange={([v]) =>
                        setNewMemory({ ...newMemory, confidence: v / 100 })
                      }
                      max={100}
                      step={5}
                    />
                  </div>
                  <Button
                    onClick={handleAddMemory}
                    disabled={!newMemory.content.trim() || isCreating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        保存中...
                      </>
                    ) : (
                      '保存记忆'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Last Updated + Refresh Bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              上次更新: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: zhCN })}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>
              显示 {filteredMemories.length} / {memories.length} 条
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-[11px] text-muted-foreground"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b">
          {filterPills.map((pill) => (
            <button
              key={pill.type}
              onClick={() => setFilterType(pill.type)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 border',
                filterType === pill.type
                  ? pillColors[pill.type]
                  : 'bg-transparent text-muted-foreground border-transparent hover:border-border'
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* 个人画像 Profile Section - 基于数据库实际记忆动态显示 */}
        <div className="px-6 py-4 border-b bg-muted/10">
          <div className="glass-card rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Profile Info - 从记忆库中提取实际身份 */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                  <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">飘叔</h3>
                    {profileData?.isSeeded && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        已初始化
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    10年+ 全栈架构师 · Web4.0理论构建者 · AFC公链核心设计者
                  </p>
                  {/* Top Skills - 来自飘叔真实画像 */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                      <Code2 className="h-2.5 w-2.5" />
                      全栈架构
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      <Server className="h-2.5 w-2.5" />
                      Web4.0/区块链
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
                      <Cpu className="h-2.5 w-2.5" />
                      AI Agent
                    </span>
                  </div>
                </div>
              </div>
              {/* Right: Seed Button + Type Counts */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={profileData?.isSeeded ? 'outline' : 'default'}
                  className={cn(
                    'gap-1.5 text-xs h-7',
                    !profileData?.isSeeded && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  )}
                  onClick={handleSeedProfile}
                  disabled={isSeeding}
                >
                  {isSeeding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {profileData?.isSeeded ? '刷新画像' : '初始化画像'}
                </Button>
                {/* Type Counts */}
                {profileData?.typeCounts && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {Object.entries(profileData.typeCounts)
                      .filter(([, count]) => count > 0)
                      .map(([type, count]) => (
                        <span
                          key={type}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium',
                            pillColors[type] || 'bg-muted text-muted-foreground'
                          )}
                        >
                          {type === 'fact' ? '事实' : type === 'skill' ? '技能' : type === 'preference' ? '偏好' : type === 'rule' ? '规则' : type === 'context' ? '上下文' : '事件'} {count}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Toggle + Memory Grid/Graph */}
        {viewMode === 'list' ? (
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 flex flex-col gap-3">
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-1.5 w-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
                {filteredMemories.map((memory, i) => (
                  <motion.div
                    key={memory.id}
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: prefersReducedMotion ? 0 : i * 0.03 }}
                  >
                    <MemoryCard
                      memory={memory}
                      onSelect={setSelectedMemoryId}
                    />
                  </motion.div>
                ))}
              </div>
            )}
            {filteredMemories.length === 0 && !isLoading && (
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
                  <Brain className="h-12 w-12 text-muted-foreground/30" />
                </motion.div>
                <p className="text-sm text-muted-foreground">暂无记忆</p>
                <p className="text-xs text-muted-foreground/60">点击"添加记忆"创建第一条记忆</p>
              </motion.div>
            )}
          </ScrollArea>
        ) : (
          <MemoryGraph
            onNodeClick={(id) => setSelectedMemoryId(id)}
            selectedMemoryId={selectedMemoryId}
            filterType={filterType}
          />
        )}
      </div>

      {/* Detail Panel */}
      {selectedMemory && (
        <div className="w-[380px] shrink-0 border-l bg-background dark:bg-white/[0.02] dark:backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">记忆详情</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedMemoryId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 flex flex-col gap-4">
              {/* Content */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">内容</p>
                <p className="text-sm leading-relaxed">{selectedMemory.content}</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">类型</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedMemory.memoryType}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">来源</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedMemory.sourceType}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">重要性</p>
                  <p>{Math.round(selectedMemory.importance * 100)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">置信度</p>
                  <p>{Math.round(selectedMemory.confidence * 100)}%</p>
                </div>
              </div>

              {/* Version History */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  版本历史 ({memoryVersions.length > 0 ? memoryVersions.length : 1})
                </p>
                <div className="flex flex-col gap-2">
                  {memoryVersions.length > 0 ? (
                    memoryVersions.map((version, idx) => (
                      <div key={version.id} className="flex items-start gap-2 text-xs">
                        <div className={cn(
                          "mt-0.5 h-2 w-2 rounded-full shrink-0",
                          idx === 0 ? "bg-emerald-500" : "bg-muted-foreground/40"
                        )} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-muted-foreground">
                            v{version.versionNo} · {' '}
                            {formatDistanceToNow(new Date(version.createdAt), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                          </span>
                          {version.changeReason && (
                            <span className="text-muted-foreground/60 text-[10px] truncate">
                              {version.changeReason}
                            </span>
                          )}
                          {version.content !== selectedMemory.content && (
                            <span className="text-[11px] text-foreground/70 mt-0.5 line-clamp-2">
                              {version.content}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">
                        v1 · 创建于{' '}
                        {formatDistanceToNow(new Date(selectedMemory.createdAt), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Related Memories */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  关联记忆 ({memoryRelations.length})
                </p>
                {memoryRelations.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {memoryRelations.map((rel) => {
                      const relTypeLabels: Record<string, string> = {
                        related_to: '关联',
                        supports: '支持',
                        contradicts: '矛盾',
                        derived_from: '来源',
                      }
                      const relTypeColors: Record<string, string> = {
                        related_to: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                        supports: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                        contradicts: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                        derived_from: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                      }
                      const relatedMemory = memories.find((m) =>
                        m.id === (rel.fromMemoryId === selectedMemory.id ? rel.toMemoryId : rel.fromMemoryId)
                      )
                      return (
                        <div key={rel.id} className="flex items-center gap-2 text-xs rounded-md border p-2">
                          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", relTypeColors[rel.relationType] || '')}>
                            {relTypeLabels[rel.relationType] || rel.relationType}
                          </Badge>
                          <span className="truncate text-foreground/80">
                            {relatedMemory?.content ?? rel.toMemoryId}
                          </span>
                          <span className="text-muted-foreground/50 ml-auto shrink-0">
                            {Math.round(rel.weight * 100)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">暂无关联</p>
                )}
              </div>

              {/* Raw Metadata */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <FileJson className="h-3 w-3" />
                  元数据
                </p>
                <pre className="rounded-lg bg-muted p-3 text-[11px] overflow-x-auto">
                  {JSON.stringify(
                    {
                      id: selectedMemory.id,
                      scope: selectedMemory.scope,
                      status: selectedMemory.status,
                      metadata: selectedMemory.metadata,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
