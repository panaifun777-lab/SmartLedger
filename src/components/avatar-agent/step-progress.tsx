'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Check, Loader2, X, Circle } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

/** A lightweight step representation for the progress component */
export interface StepInfo {
  id: string
  type: string
  name: string
  icon: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped'
  duration?: number
  error?: string
}

interface StepProgressProps {
  steps: StepInfo[]
  compact?: boolean
}

/** Status icon renderer */
function StepStatusIcon({ status }: { status: StepInfo['status'] }) {
  switch (status) {
    case 'completed':
      return <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
    case 'running':
      return <Loader2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 animate-spin" />
    case 'error':
      return <X className="h-3 w-3 text-red-500" />
    case 'pending':
      return <Circle className="h-3 w-3 text-muted-foreground/30" />
    case 'skipped':
      return <Circle className="h-3 w-3 text-muted-foreground/20" />
    default:
      return <Circle className="h-3 w-3 text-muted-foreground/30" />
  }
}

/** Color mapping for step types */
function getStepBgColor(type: string, status: StepInfo['status']): string {
  if (status === 'error') return 'bg-red-50 dark:bg-red-950/30'
  if (status === 'completed') return 'bg-emerald-50 dark:bg-emerald-950/30'
  if (status === 'running') return 'bg-emerald-50 dark:bg-emerald-950/30'

  switch (type) {
    case 'web_search': return 'bg-blue-50 dark:bg-blue-950/30'
    case 'image_gen': return 'bg-purple-50 dark:bg-purple-950/30'
    case 'tts': return 'bg-orange-50 dark:bg-orange-950/30'
    case 'vlm': return 'bg-cyan-50 dark:bg-cyan-950/30'
    case 'asr': return 'bg-pink-50 dark:bg-pink-950/30'
    case 'rag_search': return 'bg-amber-50 dark:bg-amber-950/30'
    default: return 'bg-muted/50'
  }
}

/** Format duration in ms to human readable */
function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

/** Compact step progress for inline display in chat */
export function StepProgress({ steps, compact = false }: StepProgressProps) {
  const prefersReducedMotion = useReducedMotion()

  if (!steps || steps.length === 0) return null

  // In compact mode, show a single line with step icons
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
              getStepBgColor(step.type, step.status),
              step.status === 'running' && 'ring-1 ring-emerald-300 dark:ring-emerald-700',
              step.status === 'error' && 'ring-1 ring-red-300 dark:ring-red-700',
            )}
          >
            <span className="text-xs">{step.icon}</span>
            <StepStatusIcon status={step.status} />
          </div>
        ))}
      </div>
    )
  }

  // Full step progress display
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const totalCount = steps.length

  return (
    <div className="rounded-lg border bg-card/50 p-3 space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          执行步骤 {completedCount}/{totalCount}
        </span>
        {steps.some((s) => s.status === 'running') && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            执行中
          </span>
        )}
      </div>
      <div className="space-y-1">
        <AnimatePresence>
          {steps.map((step, idx) => (
            <motion.div
              key={step.id}
              initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: idx * 0.03 }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                getStepBgColor(step.type, step.status),
                step.status === 'pending' && 'opacity-50',
              )}
            >
              <span className="text-sm shrink-0">{step.icon}</span>
              <span className={cn(
                'flex-1 min-w-0 truncate',
                step.status === 'completed' && 'text-emerald-700 dark:text-emerald-300',
                step.status === 'running' && 'text-emerald-700 dark:text-emerald-300 font-medium',
                step.status === 'error' && 'text-red-600 dark:text-red-400',
                step.status === 'pending' && 'text-muted-foreground',
              )}>
                {step.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {step.duration && step.status === 'completed' && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatDuration(step.duration)}
                  </span>
                )}
                <StepStatusIcon status={step.status} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Inline status text for the current step (shown while agent is thinking) */
export function StepStatusText({ steps }: { steps: StepInfo[] }) {
  const runningStep = steps.find((s) => s.status === 'running')
  if (!runningStep) return null

  const statusMessages: Record<string, string> = {
    rag_search: '检索记忆中...',
    web_search: '搜索网络中...',
    llm_call: '思考回复中...',
    image_gen: '生成图像中...',
    tts: '合成语音中...',
    vlm: '分析图片中...',
    asr: '识别语音中...',
  }

  return (
    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
      <span>{runningStep.icon}</span>
      {statusMessages[runningStep.type] || runningStep.name}
    </span>
  )
}
