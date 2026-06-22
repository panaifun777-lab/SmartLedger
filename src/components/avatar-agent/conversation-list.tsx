'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useChatStore, useAgentStore } from '@/stores'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pin, Trash2, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function ConversationList() {
  const { conversations, currentConversationId, setCurrentConversationId, removeConversation, deleteConversation, selectConversation, updateConversation, isLoading } = useChatStore()
  const { setActiveView } = useAgentStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const sortedConversations = [...conversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const handleSelect = async (id: string) => {
    if (editingId === id) return // Don't select while editing
    const isLocalConversation = id.startsWith('conv-')
    if (isLocalConversation) {
      setCurrentConversationId(id)
    } else {
      await selectConversation(id)
    }
    setActiveView('chat')
  }

  const handleDoubleClick = (conv: { id: string; title: string }) => {
    setEditingId(conv.id)
    setEditingTitle(conv.title)
  }

  const handleRenameSave = () => {
    if (editingId && editingTitle.trim()) {
      const trimmed = editingTitle.trim()
      // Update locally
      const { conversations } = useChatStore.getState()
      const conv = conversations.find((c) => c.id === editingId)
      if (conv && conv.title !== trimmed) {
        updateConversation(editingId, { title: trimmed })
      }
    }
    setEditingId(null)
    setEditingTitle('')
  }

  const handleRenameCancel = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleRenameCancel()
    }
  }

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">加载对话列表...</p>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">暂无对话</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">点击上方按钮开始新对话</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-2 py-2">
        <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          最近对话
        </p>
        <div className="flex flex-col gap-0.5">
          {sortedConversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                'group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150',
                'hover:bg-sidebar-accent',
                currentConversationId === conv.id
                  ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'text-sidebar-foreground/80'
              )}
              onClick={() => handleSelect(conv.id)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                {editingId === conv.id ? (
                  <Input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={handleRenameSave}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 text-sm px-1.5 py-0"
                  />
                ) : (
                  <p
                    className="text-sm truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      handleDoubleClick(conv)
                    }}
                  >
                    {conv.title}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(conv.updatedAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {conv.isPinned && (
                  <Pin className="h-3 w-3 text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeConversation(conv.id)
                    // Also delete from database if it's a persisted conversation
                    if (!conv.id.startsWith('conv-')) {
                      deleteConversation(conv.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
