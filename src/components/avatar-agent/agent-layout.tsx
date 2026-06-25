'use client'

import React, { useEffect, useState } from 'react'
import { useAgentStore, useChatStore, type MemoryTypeFilter, type ActiveView } from '@/stores'
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
  ChevronRight,
  ChevronDown,
  Sparkles,
  LogOut,
  UserCircle,
  Heart,
  Wrench,
  Clock,
  Scale,
  Calendar,
  Target,
  FolderKanban,
  CalendarClock,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FlowingBackground } from './flowing-background'
import { PWAInstallPrompt } from './pwa-install-prompt'
import { useSession, signOut } from 'next-auth/react'

// ── Top-level navigation items (always visible) ─────────────
const topNavItems: { view: ActiveView; icon: React.ElementType; label: string }[] = [
  { view: 'chat', icon: MessageSquare, label: '对话' },
  { view: 'dashboard', icon: LayoutDashboard, label: '仪表盘' },
]

// ── Sidebar sections — each can be collapsed/expanded ───────
interface SidebarSection {
  id: string
  label: string
  icon: React.ElementType
  /** Top-level view to navigate to when section header clicked */
  view?: ActiveView
  /** Sub-items inside the section */
  items?: { view?: ActiveView; label: string; icon: React.ElementType; color?: string; filter?: MemoryTypeFilter }[]
}

const sidebarSections: SidebarSection[] = [
  {
    id: 'profile',
    label: '人格画像',
    icon: User,
    view: 'profile',
  },
  {
    id: 'memory',
    label: '记忆单元',
    icon: Brain,
    view: 'memory',
    items: [
      { label: '事实', icon: UserCircle, color: 'text-blue-500', filter: 'fact' },
      { label: '偏好', icon: Heart, color: 'text-rose-500', filter: 'preference' },
      { label: '技能', icon: Wrench, color: 'text-emerald-500', filter: 'skill' },
      { label: '规则', icon: Scale, color: 'text-amber-500', filter: 'rule' },
      { label: '上下文', icon: Clock, color: 'text-violet-500', filter: 'context' },
      { label: '事件', icon: Calendar, color: 'text-cyan-500', filter: 'event' },
    ],
  },
  {
    id: 'tasks',
    label: '任务',
    icon: Target,
    view: 'tasks',
  },
  {
    id: 'conversations',
    label: '对话总结',
    icon: MessageSquare,
    view: 'conversations',
  },
  {
    id: 'projects',
    label: '项目分类',
    icon: FolderKanban,
    view: 'projects',
  },
  {
    id: 'schedule',
    label: '计划推送',
    icon: CalendarClock,
    view: 'schedule',
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: BookOpen,
    view: 'knowledge',
  },
  {
    id: 'runs',
    label: '运行记录',
    icon: Zap,
    view: 'runs',
  },
]

const bottomNavItems: { view: ActiveView; icon: React.ElementType; label: string }[] = [
  { view: 'settings', icon: Settings, label: '设置' },
]

/** Fetch memory counts by type from the dashboard API. */
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

/** A collapsible sidebar section with header + sub-items. */
function SidebarSection({
  section,
  onNavigate,
}: {
  section: SidebarSection
  onNavigate?: () => void
}) {
  const { activeView, memoryTypeFilter, setActiveView, goToMemoryWithType, expandedSections, toggleSection } = useAgentStore()
  const { counts, total } = useMemoryCounts()
  const isExpanded = expandedSections[section.id] ?? false
  const hasItems = !!section.items?.length

  const handleHeaderClick = () => {
    if (hasItems) {
      toggleSection(section.id)
    } else if (section.view) {
      setActiveView(section.view)
      onNavigate?.()
    }
  }

  return (
    <div className="px-2">
      <button
        onClick={handleHeaderClick}
        className={cn(
          'flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
          'hover:bg-sidebar-accent',
          activeView === section.view
            ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
            : 'text-sidebar-foreground/80'
        )}
      >
        <section.icon className={cn('h-3.5 w-3.5', activeView === section.view && 'text-emerald-600 dark:text-emerald-400')} />
        <span className="flex-1 text-left">{section.label}</span>
        {/* Count badge for memory section */}
        {section.id === 'memory' && total > 0 && (
          <span className="text-[10px] text-muted-foreground/70">{total}</span>
        )}
        {/* Expand/collapse chevron for sections with sub-items */}
        {hasItems && (
          <ChevronRight
            className={cn(
              'h-3 w-3 text-muted-foreground/60 transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        )}
      </button>

      {/* Sub-items */}
      {hasItems && isExpanded && (
        <div className="ml-3 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-sidebar-border/40 pl-2">
          {/* "All" link */}
          {section.id === 'memory' && (
            <button
              onClick={() => {
                setActiveView('memory')
                onNavigate?.()
              }}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                'hover:bg-sidebar-accent',
                memoryTypeFilter === 'all' && activeView === 'memory'
                  ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'text-sidebar-foreground/60'
              )}
            >
              <BookOpen className="h-3 w-3" />
              全部记忆
            </button>
          )}
          {section.items?.map((item) => {
            const Icon = item.icon
            const isActive =
              section.id === 'memory'
                ? memoryTypeFilter === item.filter && activeView === 'memory'
                : activeView === section.view
            const count = item.filter ? counts[item.filter] || 0 : 0
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (section.id === 'memory' && item.filter) {
                    goToMemoryWithType(item.filter)
                  } else if (section.view) {
                    setActiveView(section.view)
                  }
                  onNavigate?.()
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  'hover:bg-sidebar-accent',
                  isActive
                    ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                    : 'text-sidebar-foreground/60'
                )}
              >
                <Icon className={cn('h-3 w-3', item.color)} />
                {item.label}
                {count > 0 && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
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
  const { activeView, setActiveView, sidebarCollapsed, setSidebarCollapsed } = useAgentStore()
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
      {/* Logo Header + collapse button */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold tracking-wide truncate">SmartLedger</h1>
            <p className="text-[10px] text-muted-foreground truncate">飘叔智能体助手</p>
          </div>
        )}
        <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
        {/* Collapse button — hide sidebar to icon-only mode */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? '展开侧边栏' : '隐身侧边栏(只显示图标)'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-2">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4" />
          {!sidebarCollapsed && <span>新建对话</span>}
        </Button>
      </div>

      <Separator className="mx-3 w-auto" />

      {/* Top-level nav (chat / dashboard) */}
      <nav className="flex flex-col gap-1 px-3 py-2">
        {topNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.view
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                isActive
                  ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'text-sidebar-foreground/70',
                sidebarCollapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-emerald-600 dark:text-emerald-400')} />
              {!sidebarCollapsed && item.label}
              <AnimatePresence>
                {isActive && !sidebarCollapsed && (
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

      {/* Collapsible sections (memory / tasks / projects / etc) — hidden when sidebar collapsed */}
      {!sidebarCollapsed && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-1 py-2">
            {sidebarSections.map((section) => (
              <SidebarSection key={section.id} section={section} onNavigate={onNavClick} />
            ))}
          </div>

          <Separator className="mx-3 w-auto my-2" />

          {/* Recent conversations list */}
          <div className="px-3 pb-2">
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              最近对话
            </div>
            <ConversationList />
          </div>
        </ScrollArea>
      )}

      {/* When sidebar is collapsed, only show section icons */}
      {sidebarCollapsed && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-1 px-2 py-2 items-center">
            {sidebarSections.map((section) => {
              const Icon = section.icon
              const isActive = activeView === section.view
              return (
                <button
                  key={section.id}
                  onClick={() => section.view && handleNavClick(section.view)}
                  title={section.label}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-all',
                    'hover:bg-sidebar-accent',
                    isActive
                      ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                      : 'text-sidebar-foreground/70'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* Bottom: settings + user */}
      <div className="border-t border-sidebar-border p-2">
        <nav className="flex flex-col gap-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.view
            return (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  'hover:bg-sidebar-accent',
                  isActive
                    ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                    : 'text-sidebar-foreground/70',
                  sidebarCollapsed && 'justify-center px-2'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-emerald-600 dark:text-emerald-400')} />
                {!sidebarCollapsed && item.label}
              </button>
            )
          })}
        </nav>
        {!sidebarCollapsed && <UserSection />}
        {sidebarCollapsed && (
          <div className="flex justify-center pt-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold dark:bg-emerald-900 dark:text-emerald-300">
                P
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
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
      case 'conversations':
        return <ChatView />
      case 'memory':
      case 'profile':
        return <MemoryView />
      case 'knowledge':
        return <KnowledgeView />
      case 'runs':
      case 'tasks':
        return <AgentRunsView />
      case 'dashboard':
      case 'projects':
      case 'schedule':
        return <DashboardView />
      case 'settings':
        return <SettingsView />
      default:
        return <ChatView />
    }
  }

  // Mobile layout
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
          sidebarCollapsed ? 'w-[64px]' : 'w-[280px]'
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
            title={sidebarCollapsed ? '展开侧边栏' : '隐身侧边栏'}
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform duration-300',
                sidebarCollapsed && 'rotate-180'
              )}
            />
          </Button>
          <div className="text-sm text-muted-foreground">
            {topNavItems.find((i) => i.view === activeView)?.label ||
             sidebarSections.find((s) => s.view === activeView)?.label ||
             bottomNavItems.find((i) => i.view === activeView)?.label ||
             'SmartLedger'}
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
