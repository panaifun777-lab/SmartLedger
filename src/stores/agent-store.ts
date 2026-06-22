'use client'

import { create } from 'zustand'

export type ActiveView = 'chat' | 'memory' | 'knowledge' | 'runs' | 'dashboard' | 'settings'

/** Memory type filter applied when navigating to memory view from sidebar. */
export type MemoryTypeFilter = 'all' | 'fact' | 'preference' | 'skill' | 'context' | 'rule' | 'event'

interface AgentState {
  activeView: ActiveView
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  memoryTypeFilter: MemoryTypeFilter
  setActiveView: (view: ActiveView) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMemoryTypeFilter: (filter: MemoryTypeFilter) => void
  goToMemoryWithType: (filter: MemoryTypeFilter) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  activeView: 'chat',
  sidebarOpen: false,
  sidebarCollapsed: false,
  memoryTypeFilter: 'all',
  setActiveView: (view) => set({ activeView: view, sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMemoryTypeFilter: (filter) => set({ memoryTypeFilter: filter }),
  goToMemoryWithType: (filter) =>
    set({ activeView: 'memory', memoryTypeFilter: filter, sidebarOpen: false }),
}))
