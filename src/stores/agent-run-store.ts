import { create } from 'zustand';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

export type AgentRunStatus = 'running' | 'success' | 'failed' | 'cancelled';

export interface AgentRun {
  id: string;
  agentId?: string;
  userId?: string;
  taskId?: string;
  taskName?: string;
  status: AgentRunStatus;
  inputText?: string;
  outputText?: string;
  errorMessage?: string;
  toolsUsed: string[];
  duration?: number;
  metadata?: Record<string, unknown>;
  startedAt: string;
  endedAt?: string;
}

interface AgentRunStore {
  // Data
  runs: AgentRun[];
  totalRuns: number;
  currentPage: number;

  // Filters
  filterStatus: string;

  // Detail
  expandedRunId: string | null;

  // UI state
  isLoading: boolean;

  // Actions - API-backed
  loadRuns: (page?: number) => Promise<void>;
  setFilterStatus: (status: string) => void;
  toggleExpandRun: (id: string) => void;

  // UI helper actions
  setRuns: (runs: AgentRun[]) => void;
  setExpandedRunId: (id: string | null) => void;
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
    agentId: raw.agentId as string | undefined,
    userId: raw.userId as string | undefined,
    taskId: raw.taskId as string | undefined,
    taskName: raw.taskName as string | undefined,
    status: raw.status as AgentRunStatus,
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

// ============================================================
// Store
// ============================================================

const PAGE_SIZE = 20;

export const useAgentRunStore = create<AgentRunStore>((set, get) => ({
  runs: [],
  totalRuns: 0,
  currentPage: 1,
  filterStatus: 'all',
  expandedRunId: null,
  isLoading: false,

  // ── Load agent runs with filters & pagination ───────────────
  loadRuns: async (page?: number) => {
    set({ isLoading: true });
    const { filterStatus } = get();
    const currentPage = page ?? get().currentPage;

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_SIZE));
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/agent-runs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load agent runs');
      const data = await res.json();

      const rawRuns: Record<string, unknown>[] = data.runs ?? data.items ?? data ?? [];
      const runs = rawRuns.map(parseAgentRun);

      set({
        runs,
        totalRuns: data.total ?? runs.length,
        currentPage,
      });
    } catch (err) {
      toast.error('加载运行记录失败');
      console.error('[AgentRunStore] loadRuns error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Set filter and reload ───────────────────────────────────
  setFilterStatus: (status: string) => {
    set({ filterStatus: status });
  },

  // ── Toggle expanded run detail ──────────────────────────────
  toggleExpandRun: (id: string) => {
    set((state) => ({
      expandedRunId: state.expandedRunId === id ? null : id,
    }));
  },

  // ── UI helper: set runs directly ────────────────────────────
  setRuns: (runs: AgentRun[]) => {
    set({ runs, totalRuns: runs.length });
  },

  // ── UI helper: set expanded run id ──────────────────────────
  setExpandedRunId: (id: string | null) => {
    set({ expandedRunId: id });
  },
}));
