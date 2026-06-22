import { create } from 'zustand';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

export type MemoryType = 'fact' | 'preference' | 'skill' | 'context' | 'rule' | 'event';

export interface MemoryItem {
  id: string;
  agentId?: string;
  userId?: string;
  memoryType: MemoryType;
  scope: 'private' | 'team' | 'org';
  content: string;
  importance: number;
  confidence: number;
  sourceType: 'chat' | 'api' | 'file' | 'tool' | 'manual';
  sourceId?: string;
  status: 'active' | 'deprecated' | 'archived';
  metadata: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryVersion {
  id: string;
  memoryItemId: string;
  versionNo: number;
  content: string;
  metadata: Record<string, unknown>;
  changeReason?: string;
  createdAt: string;
}

export interface MemoryRelation {
  id: string;
  fromMemoryId: string;
  toMemoryId: string;
  relationType: 'related_to' | 'supports' | 'contradicts' | 'derived_from';
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface CreateMemoryPayload {
  memoryType: string;
  content: string;
  importance?: number;
  confidence?: number;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateMemoryPayload {
  content?: string;
  importance?: number;
  confidence?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface MemoryStore {
  // Data
  memories: MemoryItem[];
  totalMemories: number;
  currentPage: number;

  // Filters
  filterType: string;
  filterStatus: string;
  searchQuery: string;

  // Detail view
  selectedMemoryId: string | null;
  memoryVersions: MemoryVersion[];
  memoryRelations: MemoryRelation[];

  // UI state
  isLoading: boolean;
  isDetailOpen: boolean;

  // Actions - API-backed
  loadMemories: (page?: number) => Promise<void>;
  createMemory: (data: CreateMemoryPayload) => Promise<void>;
  updateMemory: (id: string, data: UpdateMemoryPayload) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  selectMemory: (id: string) => Promise<void>;
  closeDetail: () => void;

  // Filter actions
  setFilterType: (type: string) => void;
  setFilterStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;

  // UI helper actions
  setMemories: (memories: MemoryItem[]) => void;
  addMemory: (memory: MemoryItem) => void;
  setSelectedMemoryId: (id: string | null) => void;
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

function parseMemoryItem(raw: Record<string, unknown>): MemoryItem {
  return {
    id: raw.id as string,
    agentId: raw.agentId as string | undefined,
    userId: raw.userId as string | undefined,
    memoryType: raw.memoryType as MemoryType,
    scope: raw.scope as MemoryItem['scope'],
    content: raw.content as string,
    importance: raw.importance as number,
    confidence: raw.confidence as number,
    sourceType: raw.sourceType as MemoryItem['sourceType'],
    sourceId: raw.sourceId as string | undefined,
    status: raw.status as MemoryItem['status'],
    metadata: safeJsonParse<Record<string, unknown>>(raw.metadata, {}),
    expiresAt: raw.expiresAt as string | undefined,
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
  };
}

function parseMemoryVersion(raw: Record<string, unknown>): MemoryVersion {
  return {
    id: raw.id as string,
    memoryItemId: raw.memoryItemId as string,
    versionNo: raw.versionNo as number,
    content: raw.content as string,
    metadata: safeJsonParse<Record<string, unknown>>(raw.metadata, {}),
    changeReason: raw.changeReason as string | undefined,
    createdAt: raw.createdAt as string,
  };
}

function parseMemoryRelation(raw: Record<string, unknown>): MemoryRelation {
  return {
    id: raw.id as string,
    fromMemoryId: raw.fromMemoryId as string,
    toMemoryId: raw.toMemoryId as string,
    relationType: raw.relationType as MemoryRelation['relationType'],
    weight: raw.weight as number,
    metadata: safeJsonParse<Record<string, unknown>>(raw.metadata, {}),
    createdAt: raw.createdAt as string,
  };
}

// ============================================================
// Store
// ============================================================

const PAGE_SIZE = 20;

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  totalMemories: 0,
  currentPage: 1,

  filterType: 'all',
  filterStatus: 'all',
  searchQuery: '',

  selectedMemoryId: null,
  memoryVersions: [],
  memoryRelations: [],

  isLoading: false,
  isDetailOpen: false,

  // ── Load memories with filters & pagination ─────────────────
  loadMemories: async (page?: number) => {
    set({ isLoading: true });
    const { filterType, filterStatus, searchQuery } = get();
    const currentPage = page ?? get().currentPage;

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_SIZE));
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/memory?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load memories');
      const data = await res.json();

      const rawMemories: Record<string, unknown>[] = data.memories ?? data.items ?? data ?? [];
      const memories = rawMemories.map(parseMemoryItem);

      set({
        memories,
        totalMemories: data.total ?? memories.length,
        currentPage,
      });
    } catch (err) {
      console.error('[MemoryStore] loadMemories error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Create a new memory ─────────────────────────────────────
  createMemory: async (data: CreateMemoryPayload) => {
    try {
      const body: Record<string, unknown> = { ...data };
      if (data.metadata) body.metadata = JSON.stringify(data.metadata);

      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to create memory');
      toast.success('记忆已创建');
      await get().loadMemories(1);
    } catch (err) {
      toast.error('创建记忆失败');
      console.error('[MemoryStore] createMemory error:', err);
    }
  },

  // ── Update an existing memory ──────────────────────────────
  updateMemory: async (id: string, data: UpdateMemoryPayload) => {
    try {
      const body: Record<string, unknown> = { ...data };
      if (data.metadata) body.metadata = JSON.stringify(data.metadata);

      const res = await fetch(`/api/memory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to update memory');
      const raw = await res.json();
      const updated = parseMemoryItem(raw);

      set((state) => ({
        memories: state.memories.map((m) => (m.id === id ? updated : m)),
      }));
      toast.success('记忆已更新');
    } catch (err) {
      toast.error('更新记忆失败');
      console.error('[MemoryStore] updateMemory error:', err);
    }
  },

  // ── Delete a memory ─────────────────────────────────────────
  deleteMemory: async (id: string) => {
    try {
      const res = await fetch(`/api/memory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete memory');

      set((state) => ({
        memories: state.memories.filter((m) => m.id !== id),
        totalMemories: state.totalMemories - 1,
        selectedMemoryId: state.selectedMemoryId === id ? null : state.selectedMemoryId,
        isDetailOpen: state.selectedMemoryId === id ? false : state.isDetailOpen,
      }));
      toast.success('记忆已删除');
    } catch (err) {
      toast.error('删除记忆失败');
      console.error('[MemoryStore] deleteMemory error:', err);
    }
  },

  // ── Select a memory and load its detail ─────────────────────
  selectMemory: async (id: string) => {
    set({ selectedMemoryId: id, isDetailOpen: true, isLoading: true });
    try {
      const [versionsRes, relationsRes] = await Promise.all([
        fetch(`/api/memory/${id}/versions`),
        fetch(`/api/memory/${id}/relations`),
      ]);

      let versions: MemoryVersion[] = [];
      let relations: MemoryRelation[] = [];

      if (versionsRes.ok) {
        const versionsData = await versionsRes.json();
        const rawVersions: Record<string, unknown>[] = versionsData.versions ?? versionsData.items ?? versionsData ?? [];
        versions = rawVersions.map(parseMemoryVersion);
      }

      if (relationsRes.ok) {
        const relationsData = await relationsRes.json();
        const rawRelations: Record<string, unknown>[] = relationsData.relations ?? relationsData.items ?? relationsData ?? [];
        relations = rawRelations.map(parseMemoryRelation);
      }

      set({ memoryVersions: versions, memoryRelations: relations });
    } catch (err) {
      console.error('[MemoryStore] selectMemory error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Close the detail panel ──────────────────────────────────
  closeDetail: () => {
    set({
      selectedMemoryId: null,
      isDetailOpen: false,
      memoryVersions: [],
      memoryRelations: [],
    });
  },

  // ── Filter actions ──────────────────────────────────────────
  setFilterType: (type: string) => {
    set({ filterType: type });
  },

  setFilterStatus: (status: string) => {
    set({ filterStatus: status });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  // ── UI helper: set memories directly ────────────────────────
  setMemories: (memories: MemoryItem[]) => {
    set({ memories, totalMemories: memories.length });
  },

  // ── UI helper: add memory locally ───────────────────────────
  addMemory: (memory: MemoryItem) => {
    set((state) => ({
      memories: [memory, ...state.memories],
      totalMemories: state.totalMemories + 1,
    }));
  },

  // ── UI helper: set selected memory id ───────────────────────
  setSelectedMemoryId: (id: string | null) => {
    set({ selectedMemoryId: id, isDetailOpen: id !== null });
  },
}));
