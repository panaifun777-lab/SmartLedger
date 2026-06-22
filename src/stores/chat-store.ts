import { create } from 'zustand';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestrationStep {
  id: string;
  type: string;
  name: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  duration?: number;
  error?: string;
}

export interface OrchestrationPlan {
  id: string;
  intent: string;
  steps: OrchestrationStep[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokensUsed?: number;
  toolsCalled: string[];
  memoryRefs: string[];
  createdAt: string;
  orchestrationPlan?: OrchestrationPlan;
}

interface ChatStore {
  // Current conversation
  currentConversationId: string | null;
  conversations: Conversation[];
  messages: Message[];

  // UI state
  isLoading: boolean;
  isSending: boolean;
  selectedTools: string[];

  // Actions - API-backed
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversation: (id: string, data: Partial<Conversation>) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  toggleTool: (tool: string) => void;
  clearMessages: () => void;

  // Actions - UI helpers (for demo/local state)
  addConversation: (conv: Conversation) => void;
  setCurrentConversationId: (id: string | null) => void;
  removeConversation: (id: string) => void;
  addMessage: (msg: Message) => void;
  setIsSending: (val: boolean) => void;
}

// ============================================================
// Helpers
// ============================================================

function parseConversation(raw: Record<string, unknown>): Conversation {
  return {
    id: raw.id as string,
    title: raw.title as string,
    summary: raw.summary as string | undefined,
    tags: safeJsonParse<string[]>(raw.tags, []),
    isPinned: raw.isPinned as boolean,
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
  };
}

function parseMessage(raw: Record<string, unknown>): Message {
  return {
    id: raw.id as string,
    conversationId: raw.conversationId as string,
    role: raw.role as 'user' | 'assistant' | 'system',
    content: raw.content as string,
    model: raw.model as string | undefined,
    tokensUsed: raw.tokensUsed as number | undefined,
    toolsCalled: safeJsonParse<string[]>(raw.toolsCalled, []),
    memoryRefs: safeJsonParse<string[]>(raw.memoryRefs, []),
    createdAt: raw.createdAt as string,
  };
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ============================================================
// Store
// ============================================================

export const useChatStore = create<ChatStore>((set, get) => ({
  currentConversationId: null,
  conversations: [],
  messages: [],
  isLoading: false,
  isSending: false,
  selectedTools: [],

  // ── Load all conversations ──────────────────────────────────
  loadConversations: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      const conversations = (data.conversations ?? data ?? []).map(
        (c: Record<string, unknown>) => parseConversation(c)
      );
      set({ conversations });
    } catch (err) {
      console.error('[ChatStore] loadConversations error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Create a new conversation ───────────────────────────────
  createConversation: async (title?: string) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title ?? '新对话' }),
      });
      if (!res.ok) throw new Error('Failed to create conversation');
      const raw = await res.json();
      const conversation = parseConversation(raw);
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversationId: conversation.id,
        messages: [],
      }));
      return conversation;
    } catch (err) {
      toast.error('创建对话失败');
      console.error('[ChatStore] createConversation error:', err);
      throw err;
    }
  },

  // ── Select a conversation and load its messages ─────────────
  selectConversation: async (id: string) => {
    set({ isLoading: true, currentConversationId: id });
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      const rawMessages: Record<string, unknown>[] = data.messages ?? [];
      const messages = rawMessages.map((m) => parseMessage(m));
      set({ messages });
    } catch (err) {
      console.error('[ChatStore] selectConversation error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Delete a conversation ───────────────────────────────────
  deleteConversation: async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete conversation');
      set((state) => {
        const conversations = state.conversations.filter((c) => c.id !== id);
        const isCurrent = state.currentConversationId === id;
        return {
          conversations,
          currentConversationId: isCurrent ? conversations[0]?.id ?? null : state.currentConversationId,
          messages: isCurrent ? [] : state.messages,
        };
      });
      toast.success('对话已删除');
    } catch (err) {
      toast.error('删除对话失败');
      console.error('[ChatStore] deleteConversation error:', err);
    }
  },

  // ── Update a conversation ───────────────────────────────────
  updateConversation: async (id: string, data: Partial<Conversation>) => {
    try {
      const body: Record<string, unknown> = { ...data };
      if (data.tags !== undefined) body.tags = JSON.stringify(data.tags);
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update conversation');
      const raw = await res.json();
      const updated = parseConversation(raw);
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (err) {
      toast.error('更新对话失败');
      console.error('[ChatStore] updateConversation error:', err);
    }
  },

  // ── Send a message ──────────────────────────────────────────
  sendMessage: async (content: string) => {
    const { currentConversationId, selectedTools } = get();
    set({ isSending: true });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversationId,
          message: content,
          tools: selectedTools,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      const convId = data.conversationId ?? currentConversationId;

      const userMessage: Message = {
        id: `msg-user-${Date.now()}`,
        conversationId: convId ?? '',
        role: 'user',
        content,
        toolsCalled: [],
        memoryRefs: [],
        createdAt: new Date().toISOString(),
      };

      const assistantMessage: Message = {
        id: data.messageId ?? `msg-assistant-${Date.now()}`,
        conversationId: convId ?? '',
        role: 'assistant',
        content: data.response ?? data.output ?? '',
        model: data.model,
        tokensUsed: data.tokensUsed,
        toolsCalled: data.toolsUsed ?? [],
        memoryRefs: data.memoryRefs ?? [],
        createdAt: new Date().toISOString(),
      };

      set((state) => {
        const needsConvUpdate = !state.currentConversationId && convId;
        return {
          currentConversationId: convId ?? state.currentConversationId,
          messages: [...state.messages, userMessage, assistantMessage],
          conversations: needsConvUpdate
            ? [
                {
                  id: convId!,
                  title: '新对话',
                  tags: [],
                  isPinned: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                ...state.conversations,
              ]
            : state.conversations,
        };
      });
    } catch (err) {
      toast.error('发送消息失败');
      console.error('[ChatStore] sendMessage error:', err);
    } finally {
      set({ isSending: false });
    }
  },

  // ── Toggle a tool selection ─────────────────────────────────
  toggleTool: (tool: string) => {
    set((state) => ({
      selectedTools: state.selectedTools.includes(tool)
        ? state.selectedTools.filter((t) => t !== tool)
        : [...state.selectedTools, tool],
    }));
  },

  // ── Clear messages from current view ────────────────────────
  clearMessages: () => {
    set({ messages: [], currentConversationId: null });
  },

  // ── UI helper: add conversation locally ─────────────────────
  addConversation: (conv: Conversation) => {
    set((state) => ({
      conversations: [conv, ...state.conversations],
      currentConversationId: conv.id,
      messages: [],
    }));
  },

  // ── UI helper: set current conversation id ──────────────────
  setCurrentConversationId: (id: string | null) => {
    set({ currentConversationId: id });
  },

  // ── UI helper: remove conversation locally ──────────────────
  removeConversation: (id: string) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const isCurrent = state.currentConversationId === id;
      return {
        conversations,
        currentConversationId: isCurrent ? conversations[0]?.id ?? null : state.currentConversationId,
        messages: isCurrent ? [] : state.messages,
      };
    });
  },

  // ── UI helper: add message locally ──────────────────────────
  addMessage: (msg: Message) => {
    set((state) => ({ messages: [...state.messages, msg] }));
  },

  // ── UI helper: set sending state ────────────────────────────
  setIsSending: (val: boolean) => {
    set({ isSending: val });
  },
}));
