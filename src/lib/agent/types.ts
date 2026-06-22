// ============================================================
// Agent Orchestration Types
// ============================================================

/** Intent types for classifying user messages */
export type IntentType =
  | 'simple_qa'      // Simple Q&A → direct LLM response
  | 'search'         // Search task → web search + LLM synthesis
  | 'tool_task'      // Tool task → plan and execute tool calls
  | 'knowledge'      // Knowledge task → RAG retrieval + LLM response
  | 'multi_step';    // Complex multi-step task

/** Step types that can be executed by the orchestrator */
export type StepType =
  | 'llm_call'       // Direct LLM call
  | 'web_search'     // Web search via SDK
  | 'image_gen'      // Image generation
  | 'tts'            // Text-to-speech
  | 'vlm'            // Vision language model
  | 'asr'            // Speech-to-text
  | 'rag_search';    // RAG retrieval from memory

/** A single step in a task plan */
export interface TaskStep {
  id: string;
  type: StepType;
  name: string;          // Human-readable step name (Chinese)
  description?: string;  // More detailed description
  icon: string;          // Emoji icon for UI
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  startedAt?: number;    // Timestamp ms
  completedAt?: number;  // Timestamp ms
  duration?: number;     // ms
  input?: string;        // Input to this step
  output?: StepResult;   // Output from this step
  error?: string;        // Error message if failed
  parallel?: boolean;    // Can run in parallel with next step
  params?: Record<string, unknown>; // Step-specific parameters
}

/** Result from a step execution */
export interface StepResult {
  type: StepType;
  content: string;       // Text content of the result
  data?: Record<string, unknown>; // Additional structured data
  images?: Array<{ url: string; prompt: string }>;
  audioUrl?: string;
  searchResults?: Array<{ name: string; snippet: string; url: string }>;
  metadata?: Record<string, unknown>;
}

/** A complete task plan */
export interface TaskPlan {
  id: string;
  intent: IntentType;
  message: string;
  steps: TaskStep[];
  createdAt: number;
}

/** Context passed between steps during execution */
export interface PlanContext {
  message: string;
  conversationId?: string;
  tools: string[];
  stepResults: Map<string, StepResult>;
  chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  imageUrl?: string;
  imageBase64?: string;
  audioUrl?: string;
  audioBase64?: string;
  relevantMemories?: Array<{ id: string; content: string; memoryType: string }>;
  model?: string;
}

/** Events emitted during plan execution (for SSE streaming) */
export type PlanEvent =
  | { type: 'plan'; plan: TaskPlan }
  | { type: 'step_start'; stepId: string; stepName: string; stepIcon: string }
  | { type: 'step_progress'; stepId: string; message: string }
  | { type: 'step_result'; stepId: string; result: StepResult; duration: number }
  | { type: 'step_error'; stepId: string; error: string }
  | { type: 'llm_token'; content: string }
  | { type: 'final_result'; content: string; stepsCompleted: number; totalSteps: number; toolsUsed: string[] }
  | { type: 'image'; url: string; prompt: string }
  | { type: 'audio'; url: string }
  | { type: 'search_results'; query: string; count: number }
  | { type: 'conversation'; conversationId: string }
  | { type: 'memory'; memoryType: string; content: string }
  | { type: 'done'; messageId: string; conversationId: string; toolsUsed: string[]; plan: TaskPlan }
  | { type: 'error'; message: string };

/** Configuration for the orchestrator */
export interface OrchestratorConfig {
  maxSteps: number;
  llmModel?: string;
  ttsVoice?: string;
  ttsSpeed?: number;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
  maxSteps: 10,
  llmModel: 'glm-4-flash',
  ttsVoice: 'tongtong',
  ttsSpeed: 1.0,
};

/** Step display config for UI */
export const STEP_DISPLAY: Record<StepType, { icon: string; name: string; color: string }> = {
  llm_call:    { icon: '💬', name: 'LLM 推理',  color: 'emerald' },
  web_search:  { icon: '🔍', name: '网络搜索',  color: 'blue' },
  image_gen:   { icon: '🎨', name: '图像生成',  color: 'purple' },
  tts:         { icon: '🔊', name: '语音合成',  color: 'orange' },
  vlm:         { icon: '👁️', name: '图片分析',  color: 'cyan' },
  asr:         { icon: '🎤', name: '语音识别',  color: 'pink' },
  rag_search:  { icon: '🧠', name: '记忆检索',  color: 'amber' },
};
