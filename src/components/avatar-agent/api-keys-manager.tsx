'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Key, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
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
  const [showZhipuInput, setShowZhipuInput] = useState(false)
  const [showOpenaiInput, setShowOpenaiInput] = useState(false)
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

  const handleSaveZhipu = async () => {
    if (!zhipuKey.trim()) {
      toast.error('请输入智谱 API Key')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zhipu_api_key: zhipuKey.trim() }),
      })
      if (res.ok) {
        toast.success('智谱 API Key 已保存。需要重启容器才能生效。')
        setZhipuKey('')
        setShowZhipuInput(false)
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

  const handleSaveOpenai = async () => {
    if (!openaiKey.trim()) {
      toast.error('请输入 OpenAI API Key')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openai_api_key: openaiKey.trim() }),
      })
      if (res.ok) {
        toast.success('OpenAI API Key 已保存。需要重启容器才能生效。')
        setOpenaiKey('')
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
        // Wait 15s then reload
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

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Key className="h-4 w-4 text-emerald-600" />
          AI 功能密钥管理
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          配置智谱 / OpenAI API Key 启用图像生成、视觉理解、TTS 语音合成等功能。保存后需重启容器生效。
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
            {/* DeepSeek */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">对话</Badge>
                <span className="text-xs font-medium">DeepSeek</span>
              </div>
              {status.keys.DEEPSEEK_API_KEY ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{status.previews.DEEPSEEK_API_KEY}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              )}
            </div>

            {/* ZHIPU */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">视觉/图像/TTS</Badge>
                <span className="text-xs font-medium">智谱 GLM</span>
              </div>
              {status.keys.ZHIPU_API_KEY ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{status.previews.ZHIPU_API_KEY}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setShowZhipuInput(!showZhipuInput)}>
                  配置 Key
                </Button>
              )}
            </div>

            {/* ZHIPU input form */}
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
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveZhipu} disabled={saving || !zhipuKey.trim()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowZhipuInput(false)}>
                    取消
                  </Button>
                  <a
                    href="https://open.bigmodel.cn/usercenter/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                  >
                    获取 Key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  注册智谱开放平台免费送 2000 万 token,启用 GLM-4V-Plus(视觉) + CogView-3-Plus(图像) + CogTTS(语音)
                </p>
              </div>
            )}

            {/* OpenAI */}
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">视觉/图像/TTS/ASR</Badge>
                <span className="text-xs font-medium">OpenAI</span>
              </div>
              {status.keys.OPENAI_API_KEY ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{status.previews.OPENAI_API_KEY}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setShowOpenaiInput(!showOpenaiInput)}>
                  配置 Key
                </Button>
              )}
            </div>

            {/* OpenAI input form */}
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
                  <Button size="sm" className="h-7 text-xs" onClick={handleSaveOpenai} disabled={saving || !openaiKey.trim()}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowOpenaiInput(false)}>
                    取消
                  </Button>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                  >
                    获取 Key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  OpenAI 启用: GPT-4V(视觉) + DALL-E 3(图像) + TTS-1(语音合成) + Whisper(语音识别)
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">无法读取 Key 状态</div>
        )}

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
            <FeatureItem label="对话" enabled={!!status?.keys.DEEPSEEK_API_KEY} />
            <FeatureItem label="网络搜索" enabled={true} />
            <FeatureItem label="图像生成" enabled={!!status?.keys.ZHIPU_API_KEY || !!status?.keys.OPENAI_API_KEY} />
            <FeatureItem label="视觉理解" enabled={!!status?.keys.ZHIPU_API_KEY || !!status?.keys.OPENAI_API_KEY} />
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
      <span className={enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}
