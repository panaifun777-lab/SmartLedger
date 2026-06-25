'use client'

import { create } from 'zustand'

export type ActiveView =
  | 'chat'
  | 'conversations'
  | 'memory'
  | 'knowledge'
  | 'runs'
  | 'dashboard'
  | 'profile'
  | 'tasks'
  | 'projects'
  | 'schedule'
  | 'settings'

/** Memory type filter applied when navigating to memory view from sidebar. */
export type MemoryTypeFilter = 'all' | 'fact' | 'preference' | 'skill' | 'context' | 'rule' | 'event'

interface AgentState {
  activeView: ActiveView
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  /** When user clicks a memory category in the sidebar, this filter is applied
   *  to the memory view on navigation. The memory view consumes and resets it. */
  memoryTypeFilter: MemoryTypeFilter
  /** Which sidebar section is expanded (memory / tasks / projects / etc).
   *  Allows multiple sections open at once. */
  expandedSections: Record<string, boolean>
  setActiveView: (view: ActiveView) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMemoryTypeFilter: (filter: MemoryTypeFilter) => void
  /** Convenience: switch to memory view AND apply a type filter in one shot. */
  goToMemoryWithType: (filter: MemoryTypeFilter) => void
  toggleSection: (section: string) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  activeView: 'chat',
  sidebarOpen: false,
  sidebarCollapsed: false,
  memoryTypeFilter: 'all',
  expandedSections: {
    memory: true,
    tasks: false,
    projects: false,
    schedule: false,
  },
  setActiveView: (view) => set({ activeView: view, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMemoryTypeFilter: (filter) => set({ memoryTypeFilter: filter }),
  goToMemoryWithType: (filter) =>
    set({ activeView: 'memory', memoryTypeFilter: filter, sidebarOpen: false }),
  toggleSection: (section) =>
    set((s) => ({
      expandedSections: {
        ...s.expandedSections,
        [section]: !s.expandedSections[section],
      },
    })),
}))
