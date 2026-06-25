'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Bot,
  Brain,
  Shield,
  Info,
  Save,
  RotateCcw,
  Database,
  Trash2,
  Download,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  Palette,
  Search,
  ChevronDown,
  ChevronRight,
  Zap,
  Star,
  Eye,
  Code,
  Lightbulb,
  BarChart3,
  Languages,
  FileText,
  BookOpen,
  Sparkles,
  Globe,
  Wind,
  Cloud,
  Layers,
  Server,
  MessageSquare,
  MessageCircle,
  Smartphone,
  Send,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from 'next-themes'
import { PWAMobileGuide } from './pwa-mobile-guide'
import { ApiKeysManager } from './api-keys-manager'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  allModels as models,
  getModelById,
  getModelGroups,
  getAllProviders,
  getRecommendedModels,
  getDefaultModel,
  searchModels,
  type AIModel,
  type PricingTier,
  type SpeedTier,
  type QualityTier,
  type Capability,
} from '@/lib/models'

// ── Persisted State Hook ──────────────────────────────────────────
function usePersistedState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Ignore storage errors
    }
  }, [key, state])

  return [state, setState]
}

const defaultSettings = {
  agentName: 'SmartLedger',
  defaultModel: 'glm-4-flash',
  temperature: 0.7,
  autoSaveMemory: true,
  importanceThreshold: 0.3,
  auditLog: true,
  dataMasking: false,
}

// ── Color Helpers ─────────────────────────────────────────────────

const colorMap: Record<string, { bg: string; text: string; border: string; lightBg: string; darkBg: string }> = {
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500',
    lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    darkBg: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-900/50',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30',
    darkBg: 'bg-amber-50 dark:bg-amber-950/40',
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900/50',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-500',
    lightBg: 'bg-orange-50 dark:bg-orange-950/30',
    darkBg: 'bg-orange-50 dark:bg-orange-950/40',
  },
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-900/50',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-500',
    lightBg: 'bg-teal-50 dark:bg-teal-950/30',
    darkBg: 'bg-teal-50 dark:bg-teal-950/40',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-900/50',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500',
    lightBg: 'bg-violet-50 dark:bg-violet-950/30',
    darkBg: 'bg-violet-50 dark:bg-violet-950/40',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-900/50',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500',
    lightBg: 'bg-rose-50 dark:bg-rose-950/30',
    darkBg: 'bg-rose-50 dark:bg-rose-950/40',
  },
  sky: {
    bg: 'bg-sky-100 dark:bg-sky-900/50',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500',
    lightBg: 'bg-sky-50 dark:bg-sky-950/30',
    darkBg: 'bg-sky-50 dark:bg-sky-950/40',
  },
  fuchsia: {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/50',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    border: 'border-fuchsia-500',
    lightBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
    darkBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500',
    lightBg: 'bg-blue-50 dark:bg-blue-950/30',
    darkBg: 'bg-blue-50 dark:bg-blue-950/40',
  },
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-900/50',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-500',
    lightBg: 'bg-slate-50 dark:bg-slate-950/30',
    darkBg: 'bg-slate-50 dark:bg-slate-950/40',
  },
}

function getColorClasses(color: string) {
  return colorMap[color] || colorMap.emerald
}

// ── Pricing Badge ─────────────────────────────────────────────────

function pricingLabel(pricing: PricingTier): string {
  switch (pricing) {
    case 'free': return '免费'
    case 'standard': return '标准'
    case 'premium': return '高级'
  }
}

function pricingColor(pricing: PricingTier): string {
  switch (pricing) {
    case 'free': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
    case 'standard': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
    case 'premium': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
  }
}

// ── Speed / Quality Dots ──────────────────────────────────────────

function speedToLevel(speed: SpeedTier): number {
  switch (speed) {
    case 'fast': return 3
    case 'medium': return 2
    case 'slow': return 1
  }
}

function qualityToLevel(quality: QualityTier): number {
  switch (quality) {
    case 'high': return 3
    case 'medium': return 2
    case 'low': return 1
  }
}

function DotIndicator({ level, max = 4, activeColor = 'bg-emerald-500', inactiveColor = 'bg-muted-foreground/20' }: {
  level: number
  max?: number
  activeColor?: string
  inactiveColor?: string
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < level ? activeColor : inactiveColor}`}
        />
      ))}
    </div>
  )
}

// ── Capability Icons ──────────────────────────────────────────────

const capabilityInfo: Record<Capability, { label: string; icon: React.ElementType }> = {
  chat: { label: '对话', icon: Bot },
  reasoning: { label: '推理', icon: Lightbulb },
  code: { label: '代码', icon: Code },
  creative: { label: '创意', icon: Sparkles },
  analysis: { label: '分析', icon: BarChart3 },
  translation: { label: '翻译', icon: Languages },
  summarization: { label: '摘要', icon: FileText },
  long_context: { label: '长文本', icon: BookOpen },
  vision: { label: '视觉', icon: Eye },
}

// ── Provider Icon Mapping ─────────────────────────────────────────

const providerIconMap: Record<string, React.ElementType> = {
  Sparkles,
  Bot,
  Brain,
  Search,
  Cloud,
  Globe,
  Layers,
  Wind,
  Moon,
  Zap,
  Server,
}

function getProviderIcon(iconName: string): React.ElementType {
  return providerIconMap[iconName] || Bot
}

// ── Provider Icon Display Component (avoids creating components during render) ──

function ProviderIconDisplay({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = providerIconMap[iconName] || Bot
  return <Icon className={className} />
}

// ── Model Card Component ──────────────────────────────────────────

function ModelCard({
  model,
  isSelected,
  onSelect,
}: {
  model: AIModel
  isSelected: boolean
  onSelect: () => void
}) {
  const colors = getColorClasses(model.color)

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-md border p-2 transition-all duration-150 hover:shadow-sm ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
          : 'border-border bg-card hover:border-muted-foreground/30'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-xs font-semibold leading-tight truncate">{model.name}</span>
        {isSelected && (
          <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex items-center flex-wrap gap-0.5 mb-1">
        <Badge
          variant="secondary"
          className={`text-[9px] px-1 py-0 h-3.5 rounded ${colors.bg} ${colors.text} border-0`}
        >
          <ProviderIconDisplay iconName={model.icon} className="h-2 w-2 mr-0.5" />
          {model.providerName}
        </Badge>
        <Badge
          variant="secondary"
          className={`text-[9px] px-1 py-0 h-3.5 rounded border-0 ${pricingColor(model.pricing)}`}
        >
          {pricingLabel(model.pricing)}
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-0.5">
          <Zap className="h-2 w-2" />
          <DotIndicator level={speedToLevel(model.speed)} activeColor="bg-amber-500" />
        </div>
        <div className="flex items-center gap-0.5">
          <Star className="h-2 w-2" />
          <DotIndicator level={qualityToLevel(model.quality)} activeColor="bg-violet-500" />
        </div>
      </div>
    </button>
  )
}

// ── Model Detail Panel Component ──────────────────────────────────

function ModelDetailPanel({ model }: { model: AIModel }) {
  const colors = getColorClasses(model.color)

  return (
    <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${colors.bg}`}>
          <ProviderIconDisplay iconName={model.icon} className={`h-3 w-3 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold truncate">{model.name}</h4>
          <p className="text-[10px] text-muted-foreground">{model.providerName}</p>
        </div>
        <Badge variant="secondary" className={`text-[9px] px-1 py-0 h-3.5 rounded border-0 ${pricingColor(model.pricing)}`}>
          {pricingLabel(model.pricing)}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">{model.description}</p>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-background p-1.5">
          <p className="text-[9px] text-muted-foreground">上下文窗口</p>
          <p className="text-[11px] font-semibold">{model.contextWindow}</p>
        </div>
        <div className="rounded-md bg-background p-1.5">
          <p className="text-[9px] text-muted-foreground">最大输出</p>
          <p className="text-[11px] font-semibold">{model.maxOutput}</p>
        </div>
      </div>

      {/* Speed & Quality bars */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px]">
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Zap className="h-2.5 w-2.5 text-amber-500" />
              速度
            </span>
            <span className="font-medium">
              {model.speed === 'fast' ? '快速' : model.speed === 'medium' ? '中等' : '较慢'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${(speedToLevel(model.speed) / 3) * 100}%` }}
            />
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px]">
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Star className="h-2.5 w-2.5 text-violet-500" />
              质量
            </span>
            <span className="font-medium">
              {model.quality === 'high' ? '高' : model.quality === 'medium' ? '中' : '低'}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${(qualityToLevel(model.quality) / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <p className="text-[9px] text-muted-foreground mb-1">支持能力</p>
        <div className="flex flex-wrap gap-0.5">
          {model.capabilities.map((cap) => {
            const info = capabilityInfo[cap]
            if (!info) return null
            const Icon = info.icon
            return (
              <Badge
                key={cap}
                variant="secondary"
                className="text-[9px] px-1 py-0 h-4 rounded gap-0.5"
              >
                <Icon className="h-2 w-2" />
                {info.label}
              </Badge>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Filter Tab Type ───────────────────────────────────────────────
type FilterTab = 'all' | 'free' | 'standard' | 'premium'

// ── Bot Connection Types ──────────────────────────────────────────
type BotPlatform = 'feishu' | 'wechat' | 'telegram'
type BotConnectionStatus = 'connected' | 'disconnected' | 'error'

interface BotConnection {
  id: BotPlatform
  dbId: string | null  // CUID from database, null if not yet synced
  name: string
  icon: React.ElementType
  enabled: boolean
  status: BotConnectionStatus
  token: string        // Maps to botToken (telegram) or webhookUrl (feishu/wechat)
  chatId: string
  webhookUrl: string   // Separate webhook URL field (for telegram webhook setup)
  configOpen: boolean
  testing: boolean
  saving: boolean
}

const defaultBotConnections: BotConnection[] = [
  {
    id: 'feishu',
    dbId: null,
    name: '飞书',
    icon: MessageCircle,
    enabled: false,
    status: 'disconnected',
    token: '',
    chatId: '',
    webhookUrl: '',
    configOpen: false,
    testing: false,
    saving: false,
  },
  {
    id: 'wechat',
    dbId: null,
    name: '微信',
    icon: Smartphone,
    enabled: false,
    status: 'disconnected',
    token: '',
    chatId: '',
    webhookUrl: '',
    configOpen: false,
    testing: false,
    saving: false,
  },
  {
    id: 'telegram',
    dbId: null,
    name: 'Telegram',
    icon: Send,
    enabled: false,
    status: 'disconnected',
    token: '',
    chatId: '',
    webhookUrl: '',
    configOpen: false,
    testing: false,
    saving: false,
  },
]

// ── Main Settings View ────────────────────────────────────────────

export function SettingsView() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = usePersistedState('avatar-agent-settings', defaultSettings)
  const [isClearingConversations, setIsClearingConversations] = useState(false)
  const [isClearingMemories, setIsClearingMemories] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Bot connection state (persisted for token/chatId/webhookUrl, UI state for the rest)
  // Note: dbId is NOT persisted — it's loaded fresh from the API on mount
  const [botConnections, setBotConnections] = usePersistedState<Omit<BotConnection, 'icon' | 'configOpen' | 'testing' | 'saving' | 'dbId'>[]>(
    'avatar-bot-connections',
    defaultBotConnections.map(({ icon, configOpen, testing, saving, dbId, ...rest }) => rest)
  )
  const [botDbIds, setBotDbIds] = useState<Record<BotPlatform, string | null>>({
    feishu: null,
    wechat: null,
    telegram: null,
  })
  const [botUiState, setBotUiState] = useState<Record<BotPlatform, { configOpen: boolean; testing: boolean; saving: boolean }>>({
    feishu: { configOpen: false, testing: false, saving: false },
    wechat: { configOpen: false, testing: false, saving: false },
    telegram: { configOpen: false, testing: false, saving: false },
  })
  const [botLoading, setBotLoading] = useState(true)

  // Merge persisted data with defaults and UI state
  const mergedBotConnections: BotConnection[] = defaultBotConnections.map((def) => {
    const saved = botConnections.find((c) => c.id === def.id)
    const ui = botUiState[def.id]
    return {
      ...def,
      ...(saved || {}),
      dbId: botDbIds[def.id] ?? null,
      ...ui,
    }
  })

  // Load bot connections from API on mount
  useEffect(() => {
    let cancelled = false
    async function loadBotConnections() {
      try {
        const res = await fetch('/api/bot-connections')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (cancelled) return
        // API returns { connections: [...], total: N }
        const connections = Array.isArray(data) ? data : (data.connections || [])
        if (connections.length > 0) {
          // Map DB CUIDs by platform
          const dbIdMap: Record<BotPlatform, string | null> = { feishu: null, wechat: null, telegram: null }
          for (const remote of connections) {
            const platform = remote.platform as BotPlatform
            if (platform) {
              dbIdMap[platform] = remote.id
            }
          }
          setBotDbIds(dbIdMap)

          setBotConnections((prev) => {
            const updated = defaultBotConnections.map((def) => {
              const existing = prev.find((c) => c.id === def.id)
              const remote = connections.find((r: { platform: string }) => r.platform === def.id)
              // Map DB fields back to UI fields:
              // - For telegram: botToken -> token
              // - For feishu/wechat: webhookUrl -> token (primary), botToken as fallback
              let tokenValue = existing?.token ?? ''
              if (remote) {
                if (def.id === 'telegram') {
                  tokenValue = remote.botToken ?? existing?.token ?? ''
                } else {
                  // feishu/wechat: prefer webhookUrl as the primary token field
                  tokenValue = remote.webhookUrl ?? remote.botToken ?? existing?.token ?? ''
                }
              }
              return {
                id: def.id,
                name: remote?.name ?? def.name,
                enabled: remote?.enabled ?? existing?.enabled ?? false,
                status: (remote?.status ?? existing?.status ?? 'disconnected') as BotConnectionStatus,
                token: tokenValue,
                chatId: remote?.chatId ?? existing?.chatId ?? '',
                webhookUrl: remote?.webhookUrl ?? existing?.webhookUrl ?? '',
              }
            })
            return updated
          })
        }
      } catch {
        // API not ready yet, use persisted state silently
      } finally {
        if (!cancelled) setBotLoading(false)
      }
    }
    loadBotConnections()
    return () => { cancelled = true }
  }, [])

  // Helper to update a single bot connection field
  const updateBotConnection = (id: BotPlatform, updates: Partial<Omit<BotConnection, 'id' | 'icon'>>) => {
    setBotConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
    if ('configOpen' in updates || 'testing' in updates || 'saving' in updates) {
      setBotUiState((prev) => ({
        ...prev,
        [id]: {
          configOpen: updates.configOpen ?? prev[id].configOpen,
          testing: updates.testing ?? prev[id].testing,
          saving: updates.saving ?? prev[id].saving,
        },
      }))
    }
  }

  // Test bot connection (saves first to ensure DB has latest config, then tests)
  const handleTestBotConnection = async (id: BotPlatform) => {
    const conn = mergedBotConnections.find((c) => c.id === id)
    if (!conn) return

    setBotUiState((prev) => ({ ...prev, [id]: { ...prev[id], testing: true } }))
    try {
      // Map UI fields to DB fields based on platform
      const saveData: Record<string, unknown> = {
        chatId: conn.chatId || null,
        enabled: conn.enabled,
      }
      if (id === 'telegram') {
        saveData.botToken = conn.token || null
        saveData.webhookUrl = conn.webhookUrl || null
      } else {
        saveData.webhookUrl = conn.token || null
        saveData.botToken = null
      }

      // Save first to ensure DB has the latest config
      const dbId = botDbIds[id]
      let testId = dbId
      if (dbId) {
        const saveRes = await fetch(`/api/bot-connections/${dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData),
        })
        if (!saveRes.ok) throw new Error('Save before test failed')
      } else {
        // Create new connection if it doesn't exist in DB
        const createRes = await fetch('/api/bot-connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: id, name: conn.name, ...saveData }),
        })
        if (!createRes.ok) throw new Error('Create before test failed')
        const created = await createRes.json()
        testId = created.id
        setBotDbIds((prev) => ({ ...prev, [id]: created.id }))
      }

      // Now test the connection
      const res = await fetch(`/api/bot-connections/${testId}/test`, { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Test failed')
      }
      const data = await res.json()
      updateBotConnection(id, { status: data.success ? 'connected' : 'error' })
      toast({
        title: data.success ? '连接成功' : '连接失败',
        description: data.message || (data.success ? `${conn.name} 连接测试通过` : '连接测试失败，请检查配置'),
        variant: data.success ? 'default' : 'destructive',
      })
    } catch (err) {
      updateBotConnection(id, { status: 'error' })
      toast({
        title: '连接测试失败',
        description: err instanceof Error ? err.message : '无法连接到服务器，请检查网络或稍后再试',
        variant: 'destructive',
      })
    } finally {
      setBotUiState((prev) => ({ ...prev, [id]: { ...prev[id], testing: false } }))
    }
  }

  // Save bot connection
  const handleSaveBotConnection = async (id: BotPlatform) => {
    const conn = mergedBotConnections.find((c) => c.id === id)
    if (!conn) return
    setBotUiState((prev) => ({ ...prev, [id]: { ...prev[id], saving: true } }))
    try {
      // Map UI fields to DB fields based on platform
      const saveData: Record<string, unknown> = {
        chatId: conn.chatId || null,
        enabled: conn.enabled,
      }
      if (id === 'telegram') {
        saveData.botToken = conn.token || null
        saveData.webhookUrl = conn.webhookUrl || null
      } else {
        // feishu/wechat: token field maps to webhookUrl
        saveData.webhookUrl = conn.token || null
        saveData.botToken = null
      }

      const dbId = botDbIds[id]
      if (dbId) {
        // Update existing connection
        const res = await fetch(`/api/bot-connections/${dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData),
        })
        if (!res.ok) throw new Error('Save failed')
        const updated = await res.json()
        // Refresh dbId mapping in case it changed
        if (updated.id) {
          setBotDbIds((prev) => ({ ...prev, [id]: updated.id }))
        }
      } else {
        // Create new connection (shouldn't normally happen since seed data exists)
        const res = await fetch('/api/bot-connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: id,
            name: conn.name,
            ...saveData,
          }),
        })
        if (!res.ok) throw new Error('Save failed')
        const created = await res.json()
        setBotDbIds((prev) => ({ ...prev, [id]: created.id }))
      }
      toast({
        title: '保存成功',
        description: `${conn.name} Bot 配置已保存`,
      })
    } catch {
      toast({
        title: '保存失败',
        description: '无法保存配置，请检查网络或稍后再试',
        variant: 'destructive',
      })
    } finally {
      setBotUiState((prev) => ({ ...prev, [id]: { ...prev[id], saving: false } }))
    }
  }

  // Model selector state
  const [modelSearch, setModelSearch] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [moreModelsOpen, setMoreModelsOpen] = useState(true)

  // Get the current selected model object
  const selectedModel = useMemo(() => {
    return getModelById(settings.defaultModel) || getDefaultModel()
  }, [settings.defaultModel])

  // Filtered models based on search + tab
  const filteredModels = useMemo(() => {
    let result = models
    // Apply tab filter
    if (filterTab !== 'all') {
      result = result.filter((m) => m.pricing === filterTab)
    }
    // Apply search
    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.providerName.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      )
    }
    return result
  }, [modelSearch, filterTab])

  // Recommended models (filtered)
  const recommendedModels = useMemo(() => {
    return filteredModels.filter((m) => m.recommended)
  }, [filteredModels])

  // Non-recommended model groups (filtered)
  const nonRecommendedGroups = useMemo(() => {
    const nonRecommended = filteredModels.filter((m) => !m.recommended)
    const groupMap = new Map<string, AIModel[]>()
    for (const model of nonRecommended) {
      const existing = groupMap.get(model.provider)
      if (existing) {
        existing.push(model)
      } else {
        groupMap.set(model.provider, [model])
      }
    }
    // Use provider order from getAllProviders
    const providers = getAllProviders()
    return providers
      .map((p) => ({
        ...p,
        models: groupMap.get(p.provider) || [],
      }))
      .filter((g) => g.models.length > 0)
  }, [filteredModels])

  const handleSelectModel = (modelId: string) => {
    setSettings({ ...settings, defaultModel: modelId })
  }

  const handleSave = () => {
    toast({
      title: '设置已保存',
      description: '你的配置已成功更新',
    })
  }

  const handleReset = () => {
    setSettings(defaultSettings)
    toast({
      title: '设置已重置',
      description: '所有配置已恢复为默认值',
    })
  }

  const handleClearConversations = async () => {
    setIsClearingConversations(true)
    try {
      const res = await fetch('/api/conversations', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({
        title: '对话已清除',
        description: '所有对话记录已删除',
      })
    } catch {
      toast({
        title: '清除失败',
        description: '无法清除对话记录',
        variant: 'destructive',
      })
    } finally {
      setIsClearingConversations(false)
    }
  }

  const handleClearMemories = async () => {
    setIsClearingMemories(true)
    try {
      const res = await fetch('/api/memory', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({
        title: '记忆已清除',
        description: '所有记忆数据已删除',
      })
    } catch {
      toast({
        title: '清除失败',
        description: '无法清除记忆数据',
        variant: 'destructive',
      })
    } finally {
      setIsClearingMemories(false)
    }
  }

  const handleExportData = () => {
    const exportObj = {
      settings,
      exportedAt: new Date().toISOString(),
      version: 'v1.1.0',
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `avatar-agent-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: '数据已导出',
      description: '设置数据已保存为 JSON 文件',
    })
  }

  const handleResetApp = async () => {
    setIsResetting(true)
    try {
      // Clear localStorage
      window.localStorage.removeItem('avatar-agent-settings')
      // Try clearing server data
      await fetch('/api/conversations', { method: 'DELETE' }).catch(() => {})
      await fetch('/api/memory', { method: 'DELETE' }).catch(() => {})
      setSettings(defaultSettings)
      toast({
        title: '应用已重置',
        description: '所有数据已清除，即将刷新页面',
      })
      // Reload the page after a brief delay
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast({
        title: '重置失败',
        description: '部分数据可能未能清除',
        variant: 'destructive',
      })
    } finally {
      setIsResetting(false)
    }
  }

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ] as const

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <Bot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">设置</h2>
            <p className="text-xs text-muted-foreground">管理 SmartLedger Agent 配置</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            保存
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">

          {/* ── Agent Config ─────────────────────────────────────── */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-emerald-600" />
                智能体配置
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-xs">智能体名称</Label>
                <Input
                  value={settings.agentName}
                  onChange={(e) => setSettings({ ...settings, agentName: e.target.value })}
                  className="h-9"
                />
              </div>

              {/* ── Model Selection Section ─────────── */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-emerald-600" />
                    默认模型
                  </Label>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {models.length} 个可选
                  </Badge>
                </div>

                {/* Currently selected model display - compact */}
                <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2 bg-muted/30">
                  {(() => {
                    const colors = getColorClasses(selectedModel.color)
                    return (
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colors.bg}`}>
                        <ProviderIconDisplay iconName={selectedModel.icon} className={`h-3.5 w-3.5 ${colors.text}`} />
                      </div>
                    )
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate">{selectedModel.name}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1 py-0 h-3.5 rounded border-0 ${pricingColor(selectedModel.pricing)}`}
                      >
                        {pricingLabel(selectedModel.pricing)}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{selectedModel.providerName} · {selectedModel.contextWindow}</p>
                  </div>
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Model Selector Panel - always visible */}
                <div className="rounded-lg border bg-card/50 dark:bg-transparent p-2.5 space-y-2">
                  {/* Search + Filter row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="搜索模型..."
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        className="h-7 pl-8 text-xs"
                      />
                    </div>
                    {/* Filter tabs */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      {(['all', 'free', 'standard', 'premium'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setFilterTab(tab)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            filterTab === tab
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {tab === 'all' ? '全部' : tab === 'free' ? '免费' : tab === 'standard' ? '标准' : '高级'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model list with fixed height scroll */}
                  <div className="max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    <div className="space-y-2">
                      {/* Recommended Models */}
                      {recommendedModels.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Star className="h-2.5 w-2.5" />
                            推荐模型
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {recommendedModels.map((model) => (
                              <ModelCard
                                key={model.id}
                                model={model}
                                isSelected={settings.defaultModel === model.id}
                                onSelect={() => handleSelectModel(model.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* All Other Models grouped by provider */}
                      {nonRecommendedGroups.length > 0 && (
                        <Collapsible open={moreModelsOpen} onOpenChange={setMoreModelsOpen}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-0.5">
                              {moreModelsOpen ? (
                                <ChevronDown className="h-2.5 w-2.5" />
                              ) : (
                                <ChevronRight className="h-2.5 w-2.5" />
                              )}
                              更多模型 ({nonRecommendedGroups.reduce((acc, g) => acc + g.models.length, 0)} 个)
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-2 mt-1">
                              {nonRecommendedGroups.map((group) => {
                                const groupColors = getColorClasses(group.color)
                                return (
                                  <div key={group.provider}>
                                    {/* Provider Header */}
                                    <div className="flex items-center gap-1 mb-1">
                                      <div className={`flex h-4 w-4 items-center justify-center rounded ${groupColors.bg}`}>
                                        <ProviderIconDisplay iconName={group.icon} className={`h-2.5 w-2.5 ${groupColors.text}`} />
                                      </div>
                                      <span className="text-[10px] font-medium">{group.providerName}</span>
                                      <span className="text-[9px] text-muted-foreground">
                                        ({group.models.length})
                                      </span>
                                    </div>
                                    {/* Model Cards Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                      {group.models.map((model) => (
                                        <ModelCard
                                          key={model.id}
                                          model={model}
                                          isSelected={settings.defaultModel === model.id}
                                          onSelect={() => handleSelectModel(model.id)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* No results */}
                      {filteredModels.length === 0 && (
                        <div className="py-4 text-center text-[10px] text-muted-foreground">
                          未找到匹配的模型
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Model Detail Panel - compact inline */}
                <ModelDetailPanel model={selectedModel} />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs">温度 (Temperature): {settings.temperature}</Label>
                <Slider
                  value={[settings.temperature * 100]}
                  onValueChange={([v]) => setSettings({ ...settings, temperature: v / 100 })}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>精确 (0)</span>
                  <span>创意 (1)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory Settings */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-emerald-600" />
                记忆设置
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs">自动保存记忆</Label>
                  <p className="text-[11px] text-muted-foreground">
                    对话中自动提取并保存重要信息到记忆库
                  </p>
                </div>
                <Switch
                  checked={settings.autoSaveMemory}
                  onCheckedChange={(v) => setSettings({ ...settings, autoSaveMemory: v })}
                />
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label className="text-xs">
                  重要性阈值: {Math.round(settings.importanceThreshold * 100)}%
                </Label>
                <Slider
                  value={[settings.importanceThreshold * 100]}
                  onValueChange={([v]) =>
                    setSettings({ ...settings, importanceThreshold: v / 100 })
                  }
                  max={100}
                  step={5}
                />
                <p className="text-[11px] text-muted-foreground">
                  低于此阈值的记忆将被标记为低优先级
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                安全设置
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs">审计日志</Label>
                  <p className="text-[11px] text-muted-foreground">
                    记录所有智能体操作以供审计
                  </p>
                </div>
                <Switch
                  checked={settings.auditLog}
                  onCheckedChange={(v) => setSettings({ ...settings, auditLog: v })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs">数据脱敏</Label>
                  <p className="text-[11px] text-muted-foreground">
                    自动对敏感信息进行脱敏处理
                  </p>
                </div>
                <Switch
                  checked={settings.dataMasking}
                  onCheckedChange={(v) => setSettings({ ...settings, dataMasking: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4 text-emerald-600" />
                主题设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Label className="text-xs">外观模式</Label>
                <div className="grid grid-cols-3 gap-3">
                  {themeOptions.map((option) => {
                    const Icon = option.icon
                    const isActive = theme === option.value
                    return (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={`flex flex-col items-center gap-2 rounded-xl p-4 border-2 transition-all duration-150 ${
                          isActive
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50'
                            : 'border-transparent bg-muted/30 hover:bg-muted/60'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isActive
                            ? 'bg-emerald-100 dark:bg-emerald-900'
                            : 'bg-muted'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <span className={`text-xs font-medium ${
                          isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                        }`}>
                          {option.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  当前主题: {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bot Connections */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Bot 连接
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                配置飞书/微信/Telegram Bot 连接，随时随地调用分身
              </p>
            </CardHeader>
            <CardContent>
              {botLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <span className="ml-2 text-xs text-muted-foreground">加载中...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mergedBotConnections.map((conn) => {
                    const Icon = conn.icon
                    const statusConfig: Record<BotConnectionStatus, { label: string; color: string }> = {
                      connected: { label: '已连接', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
                      disconnected: { label: '未连接', color: 'bg-muted text-muted-foreground' },
                      error: { label: '连接错误', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
                    }
                    const status = statusConfig[conn.status]
                    return (
                      <div
                        key={conn.id}
                        className="glass-card rounded-xl p-4 flex flex-col gap-3"
                      >
                        {/* Platform header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                              <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-sm font-medium">{conn.name}</span>
                          </div>
                          <Switch
                            checked={conn.enabled}
                            onCheckedChange={(checked) => updateBotConnection(conn.id, { enabled: checked })}
                          />
                        </div>

                        {/* Status badge */}
                        <Badge variant="secondary" className={`w-fit text-[10px] px-2 py-0.5 ${status.color}`}>
                          {status.label}
                        </Badge>

                        {/* Config toggle button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs w-full"
                          onClick={() => setBotUiState((prev) => ({
                            ...prev,
                            [conn.id]: { ...prev[conn.id], configOpen: !prev[conn.id].configOpen },
                          }))}
                        >
                          {botUiState[conn.id].configOpen ? (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              收起配置
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-3.5 w-3.5" />
                              配置
                            </>
                          )}
                        </Button>

                        {/* Expandable config area */}
                        {botUiState[conn.id].configOpen && (
                          <div className="flex flex-col gap-3 pt-1 border-t border-border/50">
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[11px] text-muted-foreground">
                                {conn.id === 'telegram' ? 'Bot Token' : 'Webhook URL'}
                              </Label>
                              <Input
                                type="password"
                                placeholder={conn.id === 'telegram' ? '输入 Bot Token' : '输入 Webhook URL'}
                                value={conn.token}
                                onChange={(e) => updateBotConnection(conn.id, { token: e.target.value })}
                                className="text-xs h-8"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[11px] text-muted-foreground">
                                {conn.id === 'telegram' ? 'Chat ID' : 'Group ID'}
                              </Label>
                              <Input
                                placeholder={conn.id === 'telegram' ? '输入 Chat ID' : '输入 Group ID'}
                                value={conn.chatId}
                                onChange={(e) => updateBotConnection(conn.id, { chatId: e.target.value })}
                                className="text-xs h-8"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-1.5 text-xs"
                                disabled={botUiState[conn.id].testing || !conn.token}
                                onClick={() => handleTestBotConnection(conn.id)}
                              >
                                {botUiState[conn.id].testing ? (
                                  <>
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    测试中...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3 w-3" />
                                    测试连接
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 gap-1.5 text-xs"
                                disabled={botUiState[conn.id].saving}
                                onClick={() => handleSaveBotConnection(conn.id)}
                              >
                                {botUiState[conn.id].saving ? (
                                  <>
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    保存中...
                                  </>
                                ) : (
                                  <>
                                    <Save className="h-3 w-3" />
                                    保存
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-600" />
                数据管理
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs">清除所有对话</Label>
                  <p className="text-[11px] text-muted-foreground">
                    删除所有对话记录和消息
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      disabled={isClearingConversations}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isClearingConversations ? '清除中...' : '清除对话'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        确认清除所有对话？
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将删除所有对话记录和消息，且无法撤销。请确认你是否要继续。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearConversations} className="bg-red-600 hover:bg-red-700">
                        确认清除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs">清除所有记忆</Label>
                  <p className="text-[11px] text-muted-foreground">
                    删除所有记忆数据和关联关系
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      disabled={isClearingMemories}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isClearingMemories ? '清除中...' : '清除记忆'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        确认清除所有记忆？
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将删除所有记忆数据和关联关系，且无法撤销。请确认你是否要继续。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearMemories} className="bg-red-600 hover:bg-red-700">
                        确认清除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs">导出数据</Label>
                  <p className="text-[11px] text-muted-foreground">
                    将设置数据导出为 JSON 文件
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleExportData}
                >
                  <Download className="h-3.5 w-3.5" />
                  导出数据
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-xs text-red-600 dark:text-red-400">重置应用</Label>
                  <p className="text-[11px] text-muted-foreground">
                    清除所有数据和设置，恢复到初始状态
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 border-red-200 dark:border-red-900"
                      disabled={isResetting}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isResetting ? '重置中...' : '重置应用'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        确认重置整个应用？
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将清除所有对话、记忆、设置数据，并刷新页面。此操作无法撤销！
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetApp} className="bg-red-600 hover:bg-red-700">
                        确认重置
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* PWA Mobile Guide */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                移动端安装指南
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                将 SmartLedger 添加到手机主屏幕，像原生APP一样全屏使用
              </p>
            </CardHeader>
            <CardContent>
              <PWAMobileGuide />
            </CardContent>
          </Card>

          {/* AI API Keys Manager — enables image gen / VLM / TTS / ASR */}
          <ApiKeysManager />

          {/* About */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" />
                关于
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">版本</p>
                  <p className="font-medium">v1.1.0</p>
                </div>
                <div>
                  <p className="text-muted-foreground">架构</p>
                  <p className="font-medium">Next.js 16 + SQLite</p>
                </div>
                <div>
                  <p className="text-muted-foreground">框架</p>
                  <p className="font-medium">SmartLedger Agent</p>
                </div>
                <div>
                  <p className="text-muted-foreground">存储</p>
                  <p className="font-medium">Prisma + SQLite</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
