'use client'

import React, { useEffect, useState } from 'react'
import { useAgentStore, useChatStore, type MemoryTypeFilter } from '@/stores'
import { useIsMobile } from '@/hooks/use-mobile'
import { ConversationList } from './conversation-list'
import { ChatView } from './chat-view'
import { MemoryView } from './memory-view'
import { KnowledgeView } from './knowledge-view'
import { AgentRunsView } from './agent-runs-view'
import { DashboardView } from './dashboard-view'
import { SettingsView } from './settings-view'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Bot,
  MessageSquare,
  Brain,
  BookOpen,
  Zap,
  LayoutDashboard,
  Settings,
  Menu,
  Plus,
  ChevronLeft,
  Sparkles,
  LogOut,
  UserCircle,
  Heart,
  Wrench,
  Clock,
  Scale,
  Calendar,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActiveView } from '@/stores'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FlowingBackground } from './flowing-background'
import { PWAInstallPrompt } from './pwa-install-prompt'
import { useSession, signOut } from 'next-auth/react'

const navItems: { view: ActiveView; icon: React.ElementType; label: string }[] = [
  { view: 'chat', icon: MessageSquare, label: '对话' },
  { view: 'memory', icon: Brain, label: '记忆' },
  { view: 'knowledge', icon: BookOpen, label: '知识库' },
  { view: 'runs', icon: Zap, label: '运行记录' },
  { view: 'dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { view: 'settings', icon: Settings, label: '设置' },
]

const memoryCategories: { type: MemoryTypeFilter; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'fact', label: '事实', icon: UserCircle, color: 'text-blue-500' },
  { type: 'preference', label: '偏好', icon: Heart, color: 'text-rose-500' },
  { type: 'skill', label: '技能', icon: Wrench, color: 'text-emerald-500' },
  { type: 'rule', label: '规则', icon: Scale, color: 'text-amber-500' },
  { type: 'context', label: '上下文', icon: Clock, color: 'text-violet-500' },
  { type: 'event', label: '事件', icon: Calendar, color: 'text-cyan-500' },
]

function useMemoryCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let mounted = true
    const fetchCounts = async () => {
      try {
        const resp = await fetch('/api/dashboard')
        if (!resp.ok) return
        const data = await resp.json()
        if (!mounted) return
        const byType = data.memoriesByType || {}
        const sum = Object.values(byType).reduce((a: number, b: unknown) => a + (Number(b) || 0), 0)
        setCounts(byType)
        setTotal(sum)
      } catch {
        // silent fail
      }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return { counts, total }
}

function MemoryCategoryNav({ onNavigate }: { onNavigate?: () => void }) {
  const { activeView, memoryTypeFilter, goToMemoryWithType, setMemoryTypeFilter } = useAgentStore()
  const { counts, total } = useMemoryCounts()

  if (activeView !== 'memory' && memoryTypeFilter === 'all') {
    return null
  }

  return (
    <div className="px-3 py-2">
      <div className="px-2 mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          记忆分类
        </span>
        <span className="text-[10px] text-muted-foreground/60">{total}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => {
            setMemoryTypeFilter('all')
            onNavigate?.()
          }}
          className={cn(
            'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            'hover:bg-sidebar-accent',
            memoryTypeFilter === 'all' && activeView === 'memory'
              ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
              : 'text-sidebar-foreground/70'
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          全部
          <span className="ml-auto text-[10px] text-muted-foreground/70">{total}</span>
        </button>
        {memoryCategories.map((cat) => {
          const Icon = cat.icon
          const count = counts[cat.type] || 0
          const isActive = memoryTypeFilter === cat.type && activeView === 'memory'
          return (
            <button
              key={cat.type}
              onClick={() => {
                goToMemoryWithType(cat.type)
                onNavigate?.()
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                'hover:bg-sidebar-accent',
                isActive
                  ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'text-sidebar-foreground/70'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', cat.color)} />
              {cat.label}
              <span className="ml-auto text-[10px] text-muted-foreground/70">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UserSection() {
  const { data: session, status } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)

  const displayName = session?.user?.name || '加载中...'
  const initial = (session?.user?.name || '?').charAt(0).toUpperCase()

  const handleLogout = async () => {
    setLoggingOut(true)
    await signOut({ callbackUrl: '/login', redirect: true })
  }

  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold dark:bg-emerald-900 dark:text-emerald-300">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'authenticated' ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            {status === 'authenticated' ? '已登录' : status === 'loading' ? '加载中' : '未登录'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
          disabled={loggingOut || status !== 'authenticated'}
          title="登出"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { activeView, setActiveView } = useAgentStore()
  const { addConversation, setCurrentConversationId, loadConversations } = useChatStore()

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

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
    onNavClick?.()
  }

  const handleNavClick = (view: ActiveView) => {
    setActiveView(view)
    onNavClick?.()
  }

  return (
    <div className="flex h-full flex-col bg-sidebar dark:bg-sidebar/90 text-sidebar-foreground">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide">SmartLedger</h1>
          <p className="text-[10px] text-muted-foreground">智能体助手</p>
        </div>
        <Sparkles className="ml-auto h-4 w-4 text-emerald-500" />
      </div>

      <div className="px-3 pb-2">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4" />
          新建对话
        </Button>
      </div>

      <Separator className="mx-3 w-auto" />

      <nav className="flex flex-col gap-1 px-3 py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.view
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                isActive
                  ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'text-sidebar-foreground/70'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive && 'text-emerald-600 dark:text-emerald-400')} />
              {item.label}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  />
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </nav>

      <MemoryCategoryNav onNavigate={onNavClick} />

      <Separator className="mx-3 w-auto" />

      <div className="flex-1 min-h-0">
        <ConversationList />
      </div>

      <UserSection />
    </div>
  )
}

export function AgentLayout() {
  const { activeView, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useAgentStore()
  const isMobile = useIsMobile()

  const prefersReducedMotion = useReducedMotion()

  const pageVariants = {
    initial: { opacity: 0, y: prefersReducedMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : 8 },
  }

  const renderMainContent = () => {
    switch (activeView) {
      case 'chat':
        return <ChatView />
      case 'memory':
        return <MemoryView />
      case 'knowledge':
        return <KnowledgeView />
      case 'runs':
        return <AgentRunsView />
      case 'dashboard':
        return <DashboardView />
      case 'settings':
        return <SettingsView />
      default:
        return <ChatView />
    }
  }

  if (isMobile) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background dark:bg-transparent relative">
        <FlowingBackground />
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-[280px] p-0">
            <SheetTitle className="sr-only">导航菜单</SheetTitle>
            <SidebarContent onNavClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="relative z-10 flex flex-1 flex-col min-w-0">
          <header className="flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-md px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-emerald-600 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm">SmartLedger</span>
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                className="h-full"
              >
                {renderMainContent()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <PWAInstallPrompt />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background dark:bg-transparent relative">
      <FlowingBackground />
      <aside
        className={cn(
          'relative z-10 shrink-0 border-r border-sidebar-border bg-sidebar dark:bg-sidebar/90 dark:backdrop-blur-2xl transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[280px]'
        )}
      >
        <SidebarContent />
      </aside>

      <div className="relative z-10 flex flex-1 flex-col min-w-0">
        <header className="flex h-12 items-center gap-2 border-b bg-background/80 backdrop-blur-md px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8"
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform duration-300',
                sidebarCollapsed && 'rotate-180'
              )}
            />
          </Button>
          <div className="text-sm text-muted-foreground">
            {navItems.find((i) => i.view === activeView)?.label}
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="h-full"
            >
              {renderMainContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <PWAInstallPrompt />
    </div>
  )
}
