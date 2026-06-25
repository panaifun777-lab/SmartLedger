'use client'

import React, { useState } from 'react'
import type { Message } from '@/stores'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bot, User, Info, Wrench, Brain, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MarkdownRenderer } from '@/components/avatar-agent/markdown-renderer'
import { motion, useReducedMotion } from 'framer-motion'
import type { StepInfo } from './step-progress'
import { StepProgress } from './step-progress'

interface ChatMessageProps {
  message: Message
}

/** Format duration in ms to human readable */
function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

/** Intent display names in Chinese */
const INTENT_NAMES: Record<string, string> = {
  simple_qa: '简单问答',
  search: '搜索任务',
  tool_task: '工具任务',
  knowledge: '知识检索',
  multi_step: '多步任务',
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const prefersReducedMotion = useReducedMotion()
  const [stepsExpanded, setStepsExpanded] = useState(false)

  const hasOrchestration = !!message.orchestrationPlan
  const plan = message.orchestrationPlan
  const completedSteps = plan?.steps.filter((s) => s.status === 'completed').length || 0
  const totalSteps = plan?.steps.length || 0
  const totalDuration = plan?.steps.reduce((sum, s) => sum + (s.duration || 0), 0) || 0

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          {message.content}
        </div>
      </div>
    )
  }

  // Convert orchestration steps to StepInfo format for StepProgress component
  const stepInfos: StepInfo[] = plan?.steps.map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    icon: s.icon,
    status: s.status,
    duration: s.duration,
    error: s.error,
  })) || []

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex gap-2 sm:gap-3 px-2 py-2 sm:px-4 sm:py-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            'text-xs font-semibold',
            isUser
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col gap-1 max-w-[85%] sm:max-w-[80%] md:max-w-[75%] min-w-0',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Role label */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {isUser ? '你' : 'AVATAR'}
          </span>
          {message.model && !isUser && (
            <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
              {message.model}
            </span>
          )}
          {/* Orchestration intent badge */}
          {hasOrchestration && plan && !isUser && (
            <Badge
              variant="secondary"
              className="h-4 gap-1 text-[9px] px-1.5 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
            >
              {INTENT_NAMES[plan.intent] || plan.intent}
            </Badge>
          )}
        </div>

        {/* Content bubble */}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 text-sm leading-relaxed break-words',
            isUser
              ? 'bg-emerald-600 text-white rounded-br-md whitespace-pre-wrap dark:bg-emerald-700/80 dark:backdrop-blur-sm'
              : 'glass-card bg-card border rounded-bl-md text-card-foreground'
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Collapsible Agent Steps section */}
        {hasOrchestration && plan && !isUser && (
          <div className="w-full max-w-full">
            <button
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
            >
              {stepsExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>执行步骤</span>
              <span className="text-muted-foreground/60">
                {completedSteps}/{totalSteps} 完成
                {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
              </span>
            </button>

            {stepsExpanded && (
              <div className="mt-1.5">
                <StepProgress steps={stepInfos} />
              </div>
            )}
          </div>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Timestamp */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {new Date(message.createdAt).toLocaleString('zh-CN')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Tool calls badge - hidden on very small screens to save space */}
          {message.toolsCalled && message.toolsCalled.length > 0 && (
            <Badge
              variant="secondary"
              className="h-5 gap-1 text-[10px] px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 hidden xs:inline-flex sm:inline-flex"
            >
              <Wrench className="h-2.5 w-2.5" />
              {message.toolsCalled.length} 工具
            </Badge>
          )}

          {/* Memory refs badge */}
          {message.memoryRefs && message.memoryRefs.length > 0 && (
            <Badge
              variant="secondary"
              className="h-5 gap-1 text-[10px] px-1.5 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
            >
              <Brain className="h-2.5 w-2.5" />
              {message.memoryRefs.length} 记忆
            </Badge>
          )}

          {/* Token usage */}
          {message.tokensUsed && (
            <span className="text-[10px] text-muted-foreground/40">
              {message.tokensUsed} tokens
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
