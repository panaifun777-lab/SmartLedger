'use client'

import React, { useEffect, useMemo } from 'react'
import { useAgentRunStore, type AgentRun, type AgentRunStatus } from '@/stores'
import { AgentRunRow } from './agent-run-row'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Zap, RefreshCw, Loader2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

export function AgentRunsView() {
  const prefersReducedMotion = useReducedMotion()
  const { runs, filterStatus, expandedRunId, isLoading, setFilterStatus, setExpandedRunId, loadRuns } =
    useAgentRunStore()

  // Load from API on mount
  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const filteredRuns = useMemo(() => {
    if (filterStatus === 'all') return runs
    return runs.filter((r) => r.status === filterStatus)
  }, [runs, filterStatus])

  const handleToggleExpand = (id: string) => {
    setExpandedRunId(expandedRunId === id ? null : id)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">运行记录</h2>
            <p className="text-xs text-muted-foreground">{runs.length} 条记录</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as AgentRunStatus | 'all')}
          >
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="success">成功</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => loadRuns()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-6">
            <div className="rounded-lg border">
              <div className="p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full ml-auto" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>任务名称</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[80px]">耗时</TableHead>
                    <TableHead className="w-[180px]">使用工具</TableHead>
                    <TableHead className="w-[120px]">开始时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRuns.map((run) => (
                    <AgentRunRow
                      key={run.id}
                      run={run}
                      isExpanded={expandedRunId === run.id}
                      onToggleExpand={handleToggleExpand}
                    />
                  ))}
                  {filteredRuns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                        <motion.div
                          className="flex flex-col items-center gap-2"
                          initial={prefersReducedMotion ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Zap className="h-8 w-8 text-muted-foreground/30" />
                          <span>暂无运行记录</span>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
