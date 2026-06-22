// ============================================================
// AI Model Configuration — Single Source of Truth
// ============================================================
// This file defines every AI model available in AVATAR Agent,
// along with helper functions for lookups and grouping.
// ============================================================

// ── Types ────────────────────────────────────────────────────

export type PricingTier = 'free' | 'standard' | 'premium';
export type SpeedTier = 'fast' | 'medium' | 'slow';
export type QualityTier = 'high' | 'medium' | 'low';

export type Capability =
  | 'chat'
  | 'reasoning'
  | 'code'
  | 'creative'
  | 'analysis'
  | 'translation'
  | 'summarization'
  | 'long_context'
  | 'vision';

export interface AIModel {
  /** Unique identifier used in API calls & UI */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Provider key (machine-readable) */
  provider: string;
  /** Provider display name in Chinese */
  providerName: string;
  /** Short description of the model */
  description: string;
  /** Capabilities this model supports */
  capabilities: Capability[];
  /** Context window size (e.g. "128K", "1M") */
  contextWindow: string;
  /** Maximum output tokens (e.g. "4K", "8K") */
  maxOutput: string;
  /** Pricing tier */
  pricing: PricingTier;
  /** Relative speed */
  speed: SpeedTier;
  /** Relative output quality */
  quality: QualityTier;
  /** Searchable tags */
  tags: string[];
  /** Lucide icon name for the provider */
  icon: string;
  /** Tailwind colour token for provider theming */
  color: string;
  /** Whether this model is recommended to users */
  recommended: boolean;
  /** Whether this is the default model (only one should be true) */
  defaultModel: boolean;
}

export interface ProviderGroup {
  provider: string;
  providerName: string;
  icon: string;
  color: string;
  models: AIModel[];
}

// ── Model Definitions ────────────────────────────────────────

const models: AIModel[] = [
  // ── 智谱 (Zhipu/GLM) ────────────────────────────────────
  {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    provider: 'zhipu',
    providerName: '智谱',
    description: '智谱旗舰模型，综合能力最强，适合复杂任务',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '复杂任务', '高质量'],
    icon: 'Sparkles',
    color: 'emerald',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4 Flash',
    provider: 'zhipu',
    providerName: '智谱',
    description: '智谱免费模型，速度快，适合日常对话（需配置 ZHIPU_API_KEY）',
    capabilities: ['chat', 'code', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'free',
    speed: 'fast',
    quality: 'medium',
    tags: ['免费', '快速', '日常对话'],
    icon: 'Sparkles',
    color: 'emerald',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'glm-4-air',
    name: 'GLM-4 Air',
    provider: 'zhipu',
    providerName: '智谱',
    description: '智谱轻量模型，平衡速度与质量',
    capabilities: ['chat', 'code', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'free',
    speed: 'fast',
    quality: 'medium',
    tags: ['免费', '轻量', '平衡'],
    icon: 'Sparkles',
    color: 'emerald',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'glm-4-long',
    name: 'GLM-4 Long',
    provider: 'zhipu',
    providerName: '智谱',
    description: '长文本专家，支持超长上下文处理',
    capabilities: ['chat', 'long_context', 'summarization', 'analysis', 'translation'],
    contextWindow: '1M',
    maxOutput: '4K',
    pricing: 'standard',
    speed: 'medium',
    quality: 'high',
    tags: ['长文本', '大上下文', '文档分析'],
    icon: 'Sparkles',
    color: 'emerald',
    recommended: false,
    defaultModel: false,
  },

  // ── OpenAI ───────────────────────────────────────────────
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    providerName: 'OpenAI',
    description: 'OpenAI 旗舰多模态模型，综合能力出色',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization', 'vision'],
    contextWindow: '128K',
    maxOutput: '16K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '多模态', '高质量'],
    icon: 'Bot',
    color: 'amber',
    recommended: true,
    defaultModel: false,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    providerName: 'OpenAI',
    description: '轻量高效模型，性价比高，适合日常使用',
    capabilities: ['chat', 'code', 'translation', 'summarization', 'vision'],
    contextWindow: '128K',
    maxOutput: '16K',
    pricing: 'standard',
    speed: 'fast',
    quality: 'medium',
    tags: ['轻量', '性价比', '快速'],
    icon: 'Bot',
    color: 'amber',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    providerName: 'OpenAI',
    description: 'GPT-4 增强版，更快的推理速度',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['增强', '推理', '高质量'],
    icon: 'Bot',
    color: 'amber',
    recommended: false,
    defaultModel: false,
  },

  // ── Anthropic ────────────────────────────────────────────
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    providerName: 'Anthropic',
    description: 'Anthropic 旗舰模型，擅长代码和深度分析',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization', 'vision'],
    contextWindow: '200K',
    maxOutput: '8K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '代码', '分析'],
    icon: 'Brain',
    color: 'orange',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    providerName: 'Anthropic',
    description: '轻量快速模型，适合简单任务',
    capabilities: ['chat', 'translation', 'summarization'],
    contextWindow: '200K',
    maxOutput: '4K',
    pricing: 'standard',
    speed: 'fast',
    quality: 'medium',
    tags: ['轻量', '快速', '简单任务'],
    icon: 'Brain',
    color: 'orange',
    recommended: false,
    defaultModel: false,
  },

  // ── 深度求索 (DeepSeek) ─────────────────────────────────
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    providerName: '深度求索',
    description: '深度求索旗舰模型，免费且能力出色',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization'],
    contextWindow: '64K',
    maxOutput: '8K',
    pricing: 'free',
    speed: 'fast',
    quality: 'high',
    tags: ['免费', '高质量', '代码'],
    icon: 'Search',
    color: 'teal',
    recommended: true,
    defaultModel: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    providerName: '深度求索',
    description: '深度推理模型，擅长数学与逻辑推理',
    capabilities: ['chat', 'reasoning', 'code', 'analysis'],
    contextWindow: '64K',
    maxOutput: '8K',
    pricing: 'free',
    speed: 'slow',
    quality: 'high',
    tags: ['免费', '推理', '数学', '逻辑'],
    icon: 'Search',
    color: 'teal',
    recommended: true,
    defaultModel: false,
  },

  // ── 阿里通义 (Qwen) ─────────────────────────────────────
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    provider: 'qwen',
    providerName: '阿里通义',
    description: '通义千问旗舰模型，综合能力最强',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization'],
    contextWindow: '32K',
    maxOutput: '8K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '高质量', '中文'],
    icon: 'Cloud',
    color: 'violet',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    provider: 'qwen',
    providerName: '阿里通义',
    description: '通义千问增强模型，平衡性价比',
    capabilities: ['chat', 'code', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '8K',
    pricing: 'standard',
    speed: 'fast',
    quality: 'medium',
    tags: ['增强', '性价比', '中文'],
    icon: 'Cloud',
    color: 'violet',
    recommended: false,
    defaultModel: false,
  },

  // ── Google ───────────────────────────────────────────────
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    providerName: 'Google',
    description: 'Google 旗舰模型，超长上下文与多模态',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization', 'long_context', 'vision'],
    contextWindow: '1M',
    maxOutput: '8K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '多模态', '长上下文'],
    icon: 'Globe',
    color: 'rose',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    providerName: 'Google',
    description: 'Google 轻量模型，免费且支持长上下文',
    capabilities: ['chat', 'code', 'translation', 'summarization', 'long_context', 'vision'],
    contextWindow: '1M',
    maxOutput: '8K',
    pricing: 'free',
    speed: 'fast',
    quality: 'medium',
    tags: ['免费', '快速', '长上下文'],
    icon: 'Globe',
    color: 'rose',
    recommended: false,
    defaultModel: false,
  },

  // ── Meta ─────────────────────────────────────────────────
  {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B',
    provider: 'meta',
    providerName: 'Meta',
    description: 'Meta 开源模型，免费且社区活跃',
    capabilities: ['chat', 'code', 'creative', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'free',
    speed: 'fast',
    quality: 'medium',
    tags: ['免费', '开源', '社区'],
    icon: 'Layers',
    color: 'sky',
    recommended: false,
    defaultModel: false,
  },

  // ── Mistral ──────────────────────────────────────────────
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    providerName: 'Mistral',
    description: 'Mistral 旗舰模型，欧洲领先 AI',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization'],
    contextWindow: '32K',
    maxOutput: '4K',
    pricing: 'standard',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '高质量', '欧洲'],
    icon: 'Wind',
    color: 'fuchsia',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'mistral-small',
    name: 'Mistral Small',
    provider: 'mistral',
    providerName: 'Mistral',
    description: 'Mistral 轻量模型，快速且经济实惠',
    capabilities: ['chat', 'code', 'translation', 'summarization'],
    contextWindow: '32K',
    maxOutput: '4K',
    pricing: 'free',
    speed: 'fast',
    quality: 'medium',
    tags: ['轻量', '快速', '免费'],
    icon: 'Wind',
    color: 'fuchsia',
    recommended: false,
    defaultModel: false,
  },

  // ── 百度文心 (ERNIE) ─────────────────────────────────────
  {
    id: 'ernie-4.0',
    name: '文心一言 4.0',
    provider: 'baidu',
    providerName: '百度文心',
    description: '百度旗舰大模型，中文理解能力出色',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation', 'summarization'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '中文', '百度'],
    icon: 'Search',
    color: 'blue',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'ernie-3.5',
    name: '文心一言 3.5',
    provider: 'baidu',
    providerName: '百度文心',
    description: '百度轻量模型，适合日常中文对话',
    capabilities: ['chat', 'code', 'translation', 'summarization'],
    contextWindow: '96K',
    maxOutput: '4K',
    pricing: 'standard',
    speed: 'fast',
    quality: 'medium',
    tags: ['轻量', '中文', '日常对话'],
    icon: 'Search',
    color: 'blue',
    recommended: false,
    defaultModel: false,
  },

  // ── 月之暗面 (Moonshot/Kimi) ─────────────────────────────
  {
    id: 'moonshot-v1-128k',
    name: 'Kimi 128K',
    provider: 'moonshot',
    providerName: '月之暗面',
    description: 'Kimi 长文本模型，超长上下文处理专家',
    capabilities: ['chat', 'code', 'long_context', 'summarization', 'translation'],
    contextWindow: '128K',
    maxOutput: '4K',
    pricing: 'standard',
    speed: 'medium',
    quality: 'high',
    tags: ['长文本', '中文', '文档分析'],
    icon: 'Moon',
    color: 'slate',
    recommended: false,
    defaultModel: false,
  },

  // ── 讯飞星火 (Spark) ─────────────────────────────────────
  {
    id: 'spark-4.0-ultra',
    name: '星火 4.0 Ultra',
    provider: 'iflytek',
    providerName: '讯飞星火',
    description: '讯飞旗舰模型，语音与多模态能力突出',
    capabilities: ['chat', 'reasoning', 'code', 'creative', 'analysis', 'translation'],
    contextWindow: '32K',
    maxOutput: '4K',
    pricing: 'premium',
    speed: 'medium',
    quality: 'high',
    tags: ['旗舰', '语音', '中文'],
    icon: 'Zap',
    color: 'amber',
    recommended: false,
    defaultModel: false,
  },

  // ── Ollama (Local) ────────────────────────────────────────
  {
    id: 'ollama-llama3',
    name: 'Llama 3 (本地)',
    provider: 'ollama',
    providerName: 'Ollama 本地',
    description: '通过 Ollama 运行的本地 Llama 3，隐私安全',
    capabilities: ['chat', 'code', 'creative', 'translation', 'summarization'],
    contextWindow: '8K',
    maxOutput: '4K',
    pricing: 'free',
    speed: 'medium',
    quality: 'medium',
    tags: ['本地', '隐私', '免费', '开源'],
    icon: 'Layers',
    color: 'slate',
    recommended: false,
    defaultModel: false,
  },
  {
    id: 'ollama-qwen2',
    name: 'Qwen2 (本地)',
    provider: 'ollama',
    providerName: 'Ollama 本地',
    description: '通过 Ollama 运行的本地通义千问，中文优化',
    capabilities: ['chat', 'code', 'translation', 'summarization'],
    contextWindow: '32K',
    maxOutput: '4K',
    pricing: 'free',
    speed: 'medium',
    quality: 'medium',
    tags: ['本地', '中文', '免费', '开源'],
    icon: 'Layers',
    color: 'slate',
    recommended: false,
    defaultModel: false,
  },

  // ── GPT-4.5 / o1 ──────────────────────────────────────────
  {
    id: 'o1-preview',
    name: 'OpenAI o1',
    provider: 'openai',
    providerName: 'OpenAI',
    description: 'OpenAI 推理模型，擅长数学与编程推理',
    capabilities: ['chat', 'reasoning', 'code', 'analysis'],
    contextWindow: '128K',
    maxOutput: '32K',
    pricing: 'premium',
    speed: 'slow',
    quality: 'high',
    tags: ['推理', '数学', '编程'],
    icon: 'Bot',
    color: 'amber',
    recommended: false,
    defaultModel: false,
  },
];

// ── Helper Functions ─────────────────────────────────────────

/**
 * Get a model by its unique ID.
 * Returns `undefined` if no model matches.
 */
export function getModelById(id: string): AIModel | undefined {
  return models.find((m) => m.id === id);
}

/**
 * Get all models belonging to a specific provider.
 */
export function getModelsByProvider(provider: string): AIModel[] {
  return models.filter((m) => m.provider === provider);
}

/**
 * Get all models marked as recommended.
 */
export function getRecommendedModels(): AIModel[] {
  return models.filter((m) => m.recommended);
}

/**
 * Get the default model (the one with `defaultModel: true`).
 * Falls back to the first model if none is explicitly set.
 */
export function getDefaultModel(): AIModel {
  return models.find((m) => m.defaultModel) ?? models[0];
}

/**
 * Get a deduplicated list of all providers with display metadata.
 */
export function getAllProviders(): { provider: string; providerName: string; icon: string; color: string }[] {
  const seen = new Set<string>();
  const result: { provider: string; providerName: string; icon: string; color: string }[] = [];

  for (const model of models) {
    if (!seen.has(model.provider)) {
      seen.add(model.provider);
      result.push({
        provider: model.provider,
        providerName: model.providerName,
        icon: model.icon,
        color: model.color,
      });
    }
  }

  return result;
}

/**
 * Group all models by provider, returning an array of ProviderGroup objects
 * sorted by the order of first appearance.
 */
export function getModelGroups(): ProviderGroup[] {
  const groupMap = new Map<string, ProviderGroup>();

  for (const model of models) {
    const existing = groupMap.get(model.provider);
    if (existing) {
      existing.models.push(model);
    } else {
      groupMap.set(model.provider, {
        provider: model.provider,
        providerName: model.providerName,
        icon: model.icon,
        color: model.color,
        models: [model],
      });
    }
  }

  return Array.from(groupMap.values());
}

/**
 * Get models that support a specific capability.
 */
export function getModelsByCapability(capability: Capability): AIModel[] {
  return models.filter((m) => m.capabilities.includes(capability));
}

/**
 * Get models by pricing tier.
 */
export function getModelsByPricing(pricing: PricingTier): AIModel[] {
  return models.filter((m) => m.pricing === pricing);
}

/**
 * Search models by a text query (matches name, description, providerName, or tags).
 */
export function searchModels(query: string): AIModel[] {
  const q = query.toLowerCase().trim();
  if (!q) return models;

  return models.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// ── Re-export the full list ──────────────────────────────────

export { models as allModels };
