'use client'

import React, { useEffect, useState } from 'react'
import { useAgentStore, useChatStore } from '@/stores'
import { StatCard } from './stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Brain,
  MessageSquare,
  Zap,
  TrendingUp,
  Plus,
  Sparkles,
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Sunrise,
  Sun,
  Moon,
  ArrowRight,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { motion, useReducedMotion } from 'framer-motion'

interface DashboardData {
  totalMemories: number
  memoriesByType: Record<string, number>
  totalConversations: number
  totalMessages: number
  recentRuns: Array<{
    id: string
    taskName?: string
    status: string
    duration?: number
    startedAt: string
    toolsUsed: string[]
  }>
  runsByStatus: Record<string, number>
  totalRuns: number
  successRate: number
  avgDuration: number | null
}

const typeLabels: Record<string, string> = {
  fact: '事实',
  preference: '偏好',
  skill: '技能',
  context: '上下文',
  rule: '规则',
  event: '事件',
}

const typeColors: Record<string, string> = {
  fact: 'bg-blue-500',
  preference: 'bg-pink-500',
  skill: 'bg-emerald-500',
  context: 'bg-amber-500',
  rule: 'bg-red-500',
  event: 'bg-purple-500',
}

const statusIcons: Record<string, React.ElementType> = {
  running: Loader2,
  success: CheckCircle2,
  failed: XCircle,
  cancelled: Clock,
}

// ── Ring Chart Component ──────────────────────────────────────────
function RingChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) return <p className="text-xs text-muted-foreground text-center py-4">暂无数据</p>

  const colors: Record<string, string> = {
    fact: '#3b82f6',
    preference: '#ec4899',
    skill: '#10b981',
    context: '#f59e0b',
    rule: '#ef4444',
    event: '#8b5cf6',
  }

  // Circumference of circle with r=15.91549430918954 ≈ 100
  // This makes percentage calculations straightforward
  const circumference = 100
  const gap = 1.5 // Gap between segments (in percentage units of circumference)

  let cumulativeOffset = 0
  const segments = Object.entries(data).map(([type, count]) => {
    const percentage = (count / total) * 100
    const segmentLength = Math.max(0, percentage - gap)
    const segment = { type, count, percentage, segmentLength, cumulativeOffset, color: colors[type] || '#64748b' }
    cumulativeOffset += percentage
    return segment
  })

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="18" cy="18" r="15.91549430918954"
              fill="transparent"
              stroke={seg.color}
              strokeWidth="3"
              strokeDasharray={`${seg.segmentLength} ${circumference - seg.segmentLength}`}
              strokeDashoffset={-seg.cumulativeOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold">{total}</span>
            <span className="text-[9px] text-muted-foreground">总计</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {segments.map((seg) => (
          <div key={seg.type} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{typeLabels[seg.type] || seg.type}</span>
            <span className="font-medium ml-auto">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Greeting Helper ───────────────────────────────────────────────
function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return { text: '早上好', icon: Sunrise, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/50' }
  } else if (hour >= 12 && hour < 18) {
    return { text: '下午好', icon: Sun, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/50' }
  } else {
    return { text: '晚上好', icon: Moon, color: 'text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50' }
  }
}

// ── Staggered Stat Cards ──────────────────────────────────────────
function DashboardStatCards({
  totalMemories,
  activeConversations,
  totalRuns,
  successRate,
}: {
  totalMemories: number
  activeConversations: number
  totalRuns: number
  successRate: number
}) {
  const prefersReducedMotion = useReducedMotion()
  const cards = [
    { title: '记忆总数', value: totalMemories, icon: Brain, color: 'emerald' as const },
    { title: '活跃对话', value: activeConversations, icon: MessageSquare, color: 'blue' as const, subtitle: '进行中' },
    { title: '总运行次数', value: totalRuns, icon: Zap, color: 'amber' as const },
    { title: '成功率', value: `${successRate}%`, icon: TrendingUp, color: 'purple' as const, subtitle: '全部时间' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : i * 0.05 }}
        >
          <StatCard
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            subtitle={card.subtitle}
          />
        </motion.div>
      ))}
    </div>
  )
}

export function DashboardView() {
  const { setActiveView } = useAgentStore()
  const { addConversation, setCurrentConversationId, conversations, loadConversations } = useChatStore()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard')
        if (res.ok) {
          const dashboardData = await res.json()
          setData(dashboardData)
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboard()
    loadConversations()
  }, [loadConversations])

  const totalMemories = data?.totalMemories ?? 0
  const activeConversations = data?.totalConversations ?? 0
  const totalRuns = data?.totalRuns ?? 0
  const successRate = data?.successRate ?? 0
  const memoryByType = data?.memoriesByType ?? {}
  const recentRuns = data?.recentRuns ?? []

  const greeting = getGreeting()
  const GreetingIcon = greeting.icon

  // Get 3 most recent conversations
  const recentConversations = [...conversations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3)

  const handleNewChat = () => {
    const newConv = {
      id: `conv-${Date.now()}`,
      title: '新对话',
      tags: [],
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addConversation(newConv)
    setCurrentConversationId(newConv.id)
    setActiveView('chat')
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col gap-6">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-5 flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-5 flex flex-col gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">仪表盘</h2>
            <p className="text-xs text-muted-foreground">AVATAR Agent 概览</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 flex flex-col gap-6">
          {/* Greeting Section */}
          <div className={cn('flex items-center gap-4 rounded-xl p-5', greeting.bg)}>
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-full bg-white/80 dark:bg-white/10 shadow-sm')}>
              <GreetingIcon className={cn('h-6 w-6', greeting.color)} />
            </div>
            <div>
              <h3 className="text-xl font-bold">{greeting.text} 👋</h3>
              <p className="text-sm text-muted-foreground">
                欢迎回来！你有 {activeConversations} 个活跃对话和 {totalMemories} 条记忆。
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <DashboardStatCards
            totalMemories={totalMemories}
            activeConversations={activeConversations}
            totalRuns={totalRuns}
            successRate={successRate}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Memory Distribution - Ring Chart */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-emerald-600" />
                  记忆分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RingChart data={memoryByType} />
              </CardContent>
            </Card>

            {/* Agent Activity Timeline */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  最近活动
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {recentRuns.map((run, index) => {
                    const StatusIcon = statusIcons[run.status] || Clock
                    return (
                      <div key={run.id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full',
                              run.status === 'success' && 'bg-emerald-100 dark:bg-emerald-900',
                              run.status === 'running' && 'bg-blue-100 dark:bg-blue-900',
                              run.status === 'failed' && 'bg-red-100 dark:bg-red-900',
                              run.status === 'cancelled' && 'bg-slate-100 dark:bg-slate-800'
                            )}
                          >
                            <StatusIcon
                              className={cn(
                                'h-3.5 w-3.5',
                                run.status === 'success' && 'text-emerald-600',
                                run.status === 'running' && 'text-blue-600 animate-spin',
                                run.status === 'failed' && 'text-red-600',
                                run.status === 'cancelled' && 'text-slate-500'
                              )}
                            />
                          </div>
                          {index < recentRuns.length - 1 && (
                            <div className="w-px h-4 bg-border mt-1" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-medium truncate">
                            {run.taskName || '未命名任务'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(run.startedAt), {
                              addSuffix: true,
                              locale: zhCN,
                            })}
                            {run.duration ? ` · ${(run.duration / 1000).toFixed(1)}s` : ''}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[9px] shrink-0',
                            run.status === 'success' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                            run.status === 'running' && 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                            run.status === 'failed' && 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                            run.status === 'cancelled' && 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {run.status === 'success' ? '成功' : run.status === 'running' ? '运行中' : run.status === 'failed' ? '失败' : '已取消'}
                        </Badge>
                      </div>
                    )
                  })}
                  {recentRuns.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">暂无运行记录</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Conversations */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                  最近对话
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground gap-1 h-7"
                  onClick={() => setActiveView('chat')}
                >
                  查看全部
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentConversations.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {recentConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        setCurrentConversationId(conv.id)
                        setActiveView('chat')
                      }}
                      className="flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50 group"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 shrink-0">
                        <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conv.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.updatedAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">暂无对话</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs mt-1"
                    onClick={handleNewChat}
                  >
                    开始新对话
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Rocket className="h-4 w-4 text-emerald-600" />
                快捷操作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={handleNewChat}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-150 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:shadow-sm border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800 transition-colors">
                    <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium">新对话</span>
                </button>
                <button
                  onClick={() => setActiveView('memory')}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:shadow-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                    <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-medium">查看记忆</span>
                </button>
                <button
                  onClick={() => setActiveView('runs')}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-150 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:shadow-sm border border-transparent hover:border-amber-200 dark:hover:border-amber-800 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 group-hover:bg-amber-200 dark:group-hover:bg-amber-800 transition-colors">
                    <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-xs font-medium">运行记录</span>
                </button>
                <button
                  onClick={() => setActiveView('settings')}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    <Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="text-xs font-medium">设置</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
