'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Key, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Loader2, Database } from 'lucide-react'
import { toast } from 'sonner'

interface KeyStatus {
  keys: {
    DEEPSEEK_API_KEY: boolean
    ZHIPU_API_KEY: boolean
    OPENAI_API_KEY: boolean
  }
  previews: {
    DEEPSEEK_API_KEY: string
    ZHIPU_API_KEY: string
    OPENAI_API_KEY: string
  }
}

export function ApiKeysManager() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [showDeepseekInput, setShowDeepseekInput] = useState(false)
  const [showZhipuInput, setShowZhipuInput] = useState(false)
  const [showOpenaiInput, setShowOpenaiInput] = useState(false)
  const [deepseekKey, setDeepseekKey] = useState('')
  const [zhipuKey, setZhipuKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/keys')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('Failed to fetch key status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSaveKey = async (keyName: 'deepseek_api_key' | 'zhipu_api_key' | 'openai_api_key', value: string, label: string) => {
    if (!value.trim()) {
      toast.error(`请输入 ${label} API Key`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [keyName]: value.trim() }),
      })
      if (res.ok) {
        toast.success(`${label} API Key 已保存。需要重启容器才能生效。`)
        setDeepseekKey('')
        setZhipuKey('')
        setOpenaiKey('')
        setShowDeepseekInput(false)
        setShowZhipuInput(false)
        setShowOpenaiInput(false)
        fetchStatus()
      } else {
        const data = await res.json()
        toast.error(data.error || '保存失败')
      }
    } catch (err) {
      toast.error('网络错误,保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = async () => {
    if (!confirm('确认重启容器?大约 10-20 秒后服务恢复,期间所有连接会断开。')) return
    setRestarting(true)
    try {
      const res = await fetch('/api/admin/restart', { method: 'POST' })
      if (res.ok) {
        toast.success('容器重启中,请等待 15 秒后刷新页面')
        setTimeout(() => {
          window.location.reload()
        }, 15000)
      } else {
        const data = await res.json()
        toast.error(data.error || '重启失败')
        setRestarting(false)
      }
    } catch (err) {
      toast.error('网络错误,重启失败')
      setRestarting(false)
    }
  }

  const handleBackfill = async () => {
    if (!confirm('确认批量生成记忆 embedding?这会调用智谱 embedding-2 API,每条记忆约 200ms。已有 embedding 的记忆会跳过。')) return
    setBackfilling(true)
    try {
      const res = await fetch('/api/admin/backfill?batchSize=50', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.remaining > 0) {
          toast.info(`已处理 ${data.embedded} 条,剩余 ${data.remaining} 条。点击继续处理。`)
        } else {
          toast.success(`完成!已为 ${data.embedded} 条记忆生成 embedding,全部处理完毕。`)
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Backfill 失败')
      }
    } catch (err) {
      toast.error('网络错误,backfill 失败')
    } finally {
      setBackfilling(false)
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Key className="h-4 w-4 text-emerald-600" />
          AI 功能密钥管理
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          配置 DeepSeek(对话)/ 智谱(视觉/图像/embedding)/ OpenAI(TTS/ASR) API Key。保存后需重启容器生效。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            加载中...
          </div>
        ) : status ? (
          <div className="space-y-2">
            {/* DeepSeek — 对话主力 */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">对话</Badge>
                <span className="text-xs font-medium">DeepSeek</span>
              </div>
              {status.keys.DEEPSEEK_API_KEY ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{status.previews.DEEPSEEK_API_KEY}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowDeepseekInput(!showDeepseekInput)}>
                    更换
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowDeepseekInput(!showDeepseekInput)}>
                  配置 Key
                </Button>
              )}
            </div>
            {showDeepseekInput && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Label htmlFor="deepseek-key" className="text-[11px]">DeepSeek API Key (sk-xxx)</Label>
                <Input
                  id="deepseek-key"
                  type="password"
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                  className="h-8 text-xs"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveKey('deepseek_api_key', deepseekKey, 'DeepSeek')} disabled={saving || !deepseekKey.trim()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowDeepseekInput(false)}>取消</Button>
                  <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5">
                    获取 Key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  DeepSeek 用于对话主力模型 (deepseek-chat / deepseek-reasoner)。注意:DeepSeek 不提供 embedding API,embedding 用智谱。
                </p>
              </div>
            )}

            {/* ZHIPU — 视觉/图像/embedding */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">视觉/图像/embedding</Badge>
                <span className="text-xs font-medium">智谱 GLM</span>
              </div>
              {status.keys.ZHIPU_API_KEY ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{status.previews.ZHIPU_API_KEY}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowZhipuInput(!showZhipuInput)}>
                    更换
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowZhipuInput(!showZhipuInput)}>
                  配置 Key
                </Button>
              )}
            </div>
            {showZhipuInput && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Label htmlFor="zhipu-key" className="text-[11px]">智谱 API Key (格式: id.secret)</Label>
                <Input
                  id="zhipu-key"
                  type="password"
                  value={zhipuKey}
                  onChange={(e) => setZhipuKey(e.target.value)}
                  placeholder="xxxxxxxx.yyyyyyyyyyyyyyyy"
                  className="h-8 text-xs"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveKey('zhipu_api_key', zhipuKey, '智谱')} disabled={saving || !zhipuKey.trim()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowZhipuInput(false)}>取消</Button>
                  <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5">
                    获取 Key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  智谱用于: GLM-4V-Plus(视觉) + CogView-3-Plus(图像生成) + embedding-2(记忆向量) + web-search-pro(搜索)。新用户送 2000 万 token。
                </p>
              </div>
            )}

            {/* OpenAI */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">TTS/ASR</Badge>
                <span className="text-xs font-medium">OpenAI</span>
              </div>
              {status.keys.OPENAI_API_KEY ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{status.previews.OPENAI_API_KEY}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowOpenaiInput(!showOpenaiInput)}>
                    更换
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0" onClick={() => setShowOpenaiInput(!showOpenaiInput)}>
                  配置 Key
                </Button>
              )}
            </div>
            {showOpenaiInput && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <Label htmlFor="openai-key" className="text-[11px]">OpenAI API Key (sk-xxx)</Label>
                <Input
                  id="openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                  className="h-8 text-xs"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveKey('openai_api_key', openaiKey, 'OpenAI')} disabled={saving || !openaiKey.trim()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowOpenaiInput(false)}>取消</Button>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5">
                    获取 Key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  OpenAI 启用: GPT-4V(视觉) + DALL-E 3(图像) + TTS-1(语音合成) + Whisper(语音识别 ASR)
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">无法读取 Key 状态</div>
        )}

        {/* Backfill button — 批量给记忆生成 embedding */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={handleBackfill}
            disabled={backfilling || !status?.keys.ZHIPU_API_KEY}
          >
            {backfilling ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                生成 embedding 中...
              </>
            ) : (
              <>
                <Database className="h-3.5 w-3.5" />
                批量生成记忆 Embedding
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            为没有向量嵌入的记忆生成 embedding (智谱 embedding-2),启用语义召回
          </p>
        </div>

        {/* Restart button */}
        <div className="pt-2 border-t">
          <Button
            variant="default"
            size="sm"
            className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleRestart}
            disabled={restarting}
          >
            {restarting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                重启中...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                保存后点击重启容器以生效
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            重启会让所有连接断开约 15 秒,之后自动恢复
          </p>
        </div>

        {/* Feature status summary */}
        <div className="pt-2 border-t">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
            功能启用状态
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <FeatureItem label="对话 (DeepSeek)" enabled={!!status?.keys.DEEPSEEK_API_KEY} />
            <FeatureItem label="网络搜索" enabled={true} />
            <FeatureItem label="图像生成" enabled={!!status?.keys.ZHIPU_API_KEY || !!status?.keys.OPENAI_API_KEY} />
            <FeatureItem label="视觉理解" enabled={!!status?.keys.ZHIPU_API_KEY || !!status?.keys.OPENAI_API_KEY} />
            <FeatureItem label="记忆 embedding" enabled={!!status?.keys.ZHIPU_API_KEY} />
            <FeatureItem label="TTS 语音合成" enabled={!!status?.keys.ZHIPU_API_KEY || !!status?.keys.OPENAI_API_KEY} />
            <FeatureItem label="ASR 语音识别" enabled={!!status?.keys.OPENAI_API_KEY} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function FeatureItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${enabled ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-muted/30'}`}>
      {enabled ? (
        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
      ) : (
        <AlertCircle className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
      )}
      <span className={`truncate ${enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  )
}
