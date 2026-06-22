'use client'

import React from 'react'
import type { AgentRun, AgentRunStatus } from '@/stores'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TableCell,
  TableRow,
} from '@/components/ui/table'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const statusConfig: Record<AgentRunStatus, { label: string; icon: React.ElementType; color: string }> = {
  running: { label: '运行中', icon: Loader2, color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
  success: { label: '成功', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  failed: { label: '失败', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800' },
  cancelled: { label: '已取消', icon: Ban, color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
}

interface AgentRunRowProps {
  run: AgentRun
  isExpanded: boolean
  onToggleExpand: (id: string) => void
}

export function AgentRunRow({ run, isExpanded, onToggleExpand }: AgentRunRowProps) {
  const config = statusConfig[run.status]
  const StatusIcon = config.icon
  const duration = run.duration
    ? run.duration >= 1000
      ? `${(run.duration / 1000).toFixed(1)}s`
      : `${run.duration}ms`
    : '-'

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => onToggleExpand(run.id)}
      >
        <TableCell>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium text-sm">
          {run.taskName || run.taskId || '未命名任务'}
        </TableCell>
        <TableCell>
          <Badge
            variant="secondary"
            className={cn('text-[10px] gap-1 border', config.color)}
          >
            <StatusIcon
              className={cn(
                'h-2.5 w-2.5',
                run.status === 'running' && 'animate-spin'
              )}
            />
            {config.label}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {run.toolsUsed.slice(0, 3).map((tool) => (
              <Badge
                key={tool}
                variant="secondary"
                className="text-[9px] gap-0.5 h-5"
              >
                <Wrench className="h-2 w-2" />
                {tool}
              </Badge>
            ))}
            {run.toolsUsed.length > 3 && (
              <Badge variant="secondary" className="text-[9px] h-5">
                +{run.toolsUsed.length - 3}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(run.startedAt), {
            addSuffix: true,
            locale: zhCN,
          })}
        </TableCell>
      </TableRow>

      {/* Expanded detail */}
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {run.inputText && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">输入</p>
                  <pre className="rounded-lg bg-background border p-3 text-xs overflow-auto max-h-32">
                    {run.inputText}
                  </pre>
                </div>
              )}
              {run.outputText && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">输出</p>
                  <pre className="rounded-lg bg-background border p-3 text-xs overflow-auto max-h-32">
                    {run.outputText}
                  </pre>
                </div>
              )}
              {run.errorMessage && (
                <div>
                  <p className="text-xs font-medium text-destructive mb-1">错误信息</p>
                  <pre className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 p-3 text-xs overflow-auto max-h-32 text-red-700 dark:text-red-300">
                    {run.errorMessage}
                  </pre>
                </div>
              )}
              {!run.inputText && !run.outputText && !run.errorMessage && (
                <div className="col-span-3 text-center text-xs text-muted-foreground py-4">
                  暂无详细信息
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
