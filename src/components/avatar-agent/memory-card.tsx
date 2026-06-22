'use client'

import React from 'react'
import type { MemoryItem } from '@/stores'
import type { MemoryType } from '@/stores'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Archive, Edit3, Link2, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const typeConfig: Record<MemoryType, { label: string; color: string; bg: string }> = {
  fact: { label: '事实', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' },
  preference: { label: '偏好', color: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 border-pink-200 dark:bg-pink-950 dark:border-pink-800' },
  skill: { label: '技能', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800' },
  context: { label: '上下文', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' },
  rule: { label: '规则', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' },
  event: { label: '事件', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800' },
}

const sourceTypeLabels: Record<string, string> = {
  chat: '对话',
  api: 'API',
  file: '文件',
  tool: '工具',
  manual: '手动',
}

interface MemoryCardProps {
  memory: MemoryItem
  onSelect: (id: string) => void
  onArchive?: (id: string) => void
}

export function MemoryCard({ memory, onSelect, onArchive }: MemoryCardProps) {
  const config = typeConfig[memory.memoryType] || typeConfig.fact

  return (
    <Card
      className="group cursor-pointer glass-card transition-all duration-200 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800"
      onClick={() => onSelect(memory.id)}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn('text-[10px] border', config.bg, config.color)}
            >
              {config.label}
            </Badge>
            {memory.metadata?.core ? (
              <Badge variant="secondary" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                核心
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation() }}>
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>编辑</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onArchive?.(memory.id) }}>
                    <Archive className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>归档</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation() }}>
                    <Link2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>关联记忆</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Content preview */}
        <p className="text-sm leading-relaxed line-clamp-3 mb-3">
          {memory.content}
        </p>

        {/* Importance bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground w-10 shrink-0">重要性</span>
          <Progress value={memory.importance * 100} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground w-8 text-right">
            {Math.round(memory.importance * 100)}%
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Brain className="h-2.5 w-2.5" />
              置信度 {Math.round(memory.confidence * 100)}%
            </span>
            <span>·</span>
            <span>来源: {sourceTypeLabels[memory.sourceType] || memory.sourceType}</span>
          </div>
          <span>
            {formatDistanceToNow(new Date(memory.createdAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
