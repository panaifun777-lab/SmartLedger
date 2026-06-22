import { create } from 'zustand';
import { toast } from 'sonner';
import type { AgentRun } from './agent-run-store';

// ============================================================
// Types
// ============================================================

export interface DashboardStats {
  totalMemories: number;
  memoriesByType: Record<string, number>;
  totalConversations: number;
  recentRuns: AgentRun[];
  runsByStatus: Record<string, number>;
  successRate: number;
  avgDuration: number;
}

interface DashboardStore {
  stats: DashboardStats | null;
  isLoading: boolean;
  loadStats: () => Promise<void>;
}

// ============================================================
// Helpers
// ============================================================

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseAgentRun(raw: Record<string, unknown>): AgentRun {
  return {
    id: raw.id as string,
    agentId: raw.agentId as string,
    userId: raw.userId as string,
    taskId: raw.taskId as string | undefined,
    taskName: raw.taskName as string | undefined,
    status: raw.status as AgentRun['status'],
    inputText: raw.inputText as string | undefined,
    outputText: raw.outputText as string | undefined,
    errorMessage: raw.errorMessage as string | undefined,
    toolsUsed: safeJsonParse<string[]>(raw.toolsUsed, []),
    duration: raw.duration as number | undefined,
    metadata: safeJsonParse<Record<string, unknown>>(raw.metadata, {}),
    startedAt: raw.startedAt as string,
    endedAt: raw.endedAt as string | undefined,
  };
}

function parseDashboardStats(raw: Record<string, unknown>): DashboardStats {
  const rawRecentRuns = raw.recentRuns;
  let recentRuns: AgentRun[] = [];

  if (Array.isArray(rawRecentRuns)) {
    recentRuns = rawRecentRuns.map(
      (r: Record<string, unknown>) => parseAgentRun(r)
    );
  }

  return {
    totalMemories: (raw.totalMemories as number) ?? 0,
    memoriesByType: (raw.memoriesByType as Record<string, number>) ?? {},
    totalConversations: (raw.totalConversations as number) ?? 0,
    recentRuns,
    runsByStatus: (raw.runsByStatus as Record<string, number>) ?? {},
    successRate: (raw.successRate as number) ?? 0,
    avgDuration: (raw.avgDuration as number) ?? 0,
  };
}

// ============================================================
// Store
// ============================================================

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  isLoading: false,

  loadStats: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard stats');
      const data = await res.json();
      const stats = parseDashboardStats(data);
      set({ stats });
    } catch (err) {
      toast.error('Failed to load dashboard');
      console.error('[DashboardStore] loadStats error:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
