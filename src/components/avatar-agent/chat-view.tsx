'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore, useAgentStore } from '@/stores'
import type { OrchestrationPlan } from '@/stores/chat-store'
import { ChatMessage } from './chat-message'
import { ToolSelector } from './tool-selector'
import { StepProgress, StepStatusText } from './step-progress'
import type { StepInfo } from './step-progress'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  Search,
  Trash2,
  Send,
  Bot,
  MessageSquare,
  Loader2,
  Volume2,
  Play,
  Mic,
  MicOff,
  ImageIcon,
  X,
  ChevronDown,
  Check,
  Sparkles,
  Zap,
  Brain,
  Globe,
  Cloud,
  Layers,
  Wind,
  Moon,
  Server,
} from 'lucide-react'
import { MarkdownRenderer } from './markdown-renderer'
import { allModels as models, getModelById, getDefaultModel, getModelGroups, type AIModel } from '@/lib/models'

const MAX_CHARS = 4000

// Pricing tier display
const pricingLabel: Record<string, { text: string; className: string }> = {
  free: { text: '免费', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  standard: { text: '标准', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' },
  premium: { text: '高级', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
}

// Provider icon mapping for chat model selector
const chatProviderIconMap: Record<string, React.ElementType> = {
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

// Model option component for popover
function ModelOption({ model, isSelected, onSelect }: { model: AIModel; isSelected: boolean; onSelect: () => void }) {
  const pricing = pricingLabel[model.pricing] || pricingLabel.standard
  const ProviderIcon = chatProviderIconMap[model.icon] || Bot
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
        isSelected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-muted/50'
      }`}
    >
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
        isSelected ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-muted'
      }`}>
        <ProviderIcon className={`h-3.5 w-3.5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
            {model.name}
          </span>
          <span className={`inline-flex items-center rounded px-1 py-0 text-[9px] font-medium leading-4 ${pricing.className}`}>
            {pricing.text}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{model.providerName} · {model.contextWindow}</p>
      </div>
      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
    </button>
  )
}

// Hook to persist selected model in localStorage
function usePersistedModel(): [string, (m: string) => void] {
  const [modelId, setModelId] = useState<string>(() => {
    if (typeof window === 'undefined') return getDefaultModel().id
    try {
      const stored = window.localStorage.getItem('avatar-selected-model')
      if (stored && getModelById(stored)) return stored
    } catch { /* ignore */ }
    return getDefaultModel().id
  })

  const setModel = (id: string) => {
    setModelId(id)
    try { window.localStorage.setItem('avatar-selected-model', id) } catch { /* ignore */ }
  }

  return [modelId, setModel]
}

export function ChatView() {
  const {
    messages,
    currentConversationId,
    conversations,
    isSending,
    sendMessage,
    addMessage,
    setIsSending,
    setCurrentConversationId,
  } = useChatStore()
  const { setActiveView } = useAgentStore()

  const [input, setInput] = useState('')
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [selectedModelId, setSelectedModelId] = usePersistedModel()
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  const currentModel = getModelById(selectedModelId) || getDefaultModel()
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingToolsUsed, setStreamingToolsUsed] = useState<string[]>([])
  const [generatedImages, setGeneratedImages] = useState<Array<{url: string, prompt: string}>>([])
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; base64: string } | null>(null)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [knowledgeRefCount, setKnowledgeRefCount] = useState<number>(0)
  const [knowledgeSources, setKnowledgeSources] = useState<string[]>([])

  // Orchestration state
  const [orchestrationSteps, setOrchestrationSteps] = useState<StepInfo[]>([])
  const [orchestrationPlan, setOrchestrationPlan] = useState<OrchestrationPlan | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const handleSendRef = useRef<((overrideMessage?: string) => Promise<void>) | null>(null)

  const currentConv = conversations.find((c) => c.id === currentConversationId)

  // Auto-scroll to bottom when messages or streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-send pending message via ref when conversation is ready
  useEffect(() => {
    if (pendingMessage && currentConversationId && !isSending) {
      const msg = pendingMessage
      setPendingMessage(null)
      // Use handleSendRef to avoid stale closure
      handleSendRef.current?.(msg)
    }
  }, [pendingMessage, currentConversationId, isSending])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const handleSend = useCallback(async (overrideMessage?: string) => {
    const messageContent = (overrideMessage ?? input).trim()
    if (!messageContent || isSending) return

    setInput('')
    setStreamingContent('')
    setStreamingToolsUsed([])
    setGeneratedImages([])
    setGeneratedAudioUrl(null)
    setKnowledgeRefCount(0)
    setKnowledgeSources([])
    setOrchestrationSteps([])
    setOrchestrationPlan(null)

    // Handle VLM image analysis if pending
    let imageAnalysisPrefix = ''
    if (pendingImage) {
      setIsAnalyzingImage(true)
      try {
        const res = await fetch('/api/vlm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: pendingImage.base64,
            question: messageContent || '请描述这张图片',
          }),
        })
        if (res.ok) {
          const data = await res.json()
          imageAnalysisPrefix = `📷 **图片分析结果：**\n\n${data.analysis ?? data.result ?? ''}\n\n---\n\n`
        }
      } catch (err) {
        console.error('VLM analysis error:', err)
      } finally {
        setIsAnalyzingImage(false)
        setPendingImage(null)
      }
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Add user message immediately for responsive UX
    const userMessage = {
      id: `msg-user-${Date.now()}`,
      conversationId: currentConversationId || '',
      role: 'user' as const,
      content: pendingImage ? `[图片] ${messageContent}` : messageContent,
      toolsCalled: pendingImage ? ['vlm'] : [],
      memoryRefs: [],
      createdAt: new Date().toISOString(),
    }
    addMessage(userMessage)
    setIsSending(true)

    // The actual message to send to LLM (prepend image analysis if any)
    const llmMessage = imageAnalysisPrefix
      ? `${imageAnalysisPrefix}用户关于图片的问题: ${messageContent}`
      : messageContent

    try {
      // Use the orchestration endpoint
      const isLocalConversation = currentConversationId?.startsWith('conv-')
      const apiConversationId = isLocalConversation ? undefined : currentConversationId

      const orchestrateRes = await fetch('/api/agent/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: llmMessage,
          conversationId: apiConversationId,
          tools: selectedTools,
          image_base64: pendingImage?.base64,
          model: selectedModelId,
        }),
      })

      if (!orchestrateRes.ok) {
        throw new Error(`Orchestrate request failed: ${orchestrateRes.status}`)
      }

      const reader = orchestrateRes.body?.getReader()
      if (!reader) {
        throw new Error('No readable stream available')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let receivedConversationId = ''
      let receivedMessageId = ''
      let receivedToolsUsed: string[] = []
      let receivedPlan: OrchestrationPlan | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            const jsonStr = line.slice(6)
            let data: Record<string, unknown>
            try {
              data = JSON.parse(jsonStr)
            } catch {
              continue
            }

            const eventType = data.type as string

            switch (eventType) {
              case 'conversation': {
                receivedConversationId = data.conversationId as string
                if (receivedConversationId && receivedConversationId !== currentConversationId) {
                  setCurrentConversationId(receivedConversationId)
                  const { conversations } = useChatStore.getState()
                  const existingIdx = conversations.findIndex((c) => c.id === currentConversationId)
                  if (existingIdx >= 0) {
                    const updatedConversations = [...conversations]
                    updatedConversations[existingIdx] = {
                      ...updatedConversations[existingIdx],
                      id: receivedConversationId,
                      title:
                        messageContent.length > 50
                          ? messageContent.substring(0, 50) + '...'
                          : messageContent,
                      updatedAt: new Date().toISOString(),
                    }
                    useChatStore.setState({ conversations: updatedConversations })
                  }
                }
                break
              }

              case 'plan': {
                // Receive the execution plan
                const planData = data.plan as { id: string; intent: string; steps: Array<{ id: string; type: string; name: string; icon: string }> }
                if (planData) {
                  const plan: OrchestrationPlan = {
                    id: planData.id,
                    intent: planData.intent,
                    steps: planData.steps.map((s) => ({
                      id: s.id,
                      type: s.type,
                      name: s.name,
                      icon: s.icon,
                      status: 'pending' as const,
                    })),
                  }
                  receivedPlan = plan
                  setOrchestrationPlan(plan)
                  setOrchestrationSteps(plan.steps.map((s) => ({
                    id: s.id,
                    type: s.type,
                    name: s.name,
                    icon: s.icon,
                    status: 'pending' as const,
                  })))
                }
                break
              }

              case 'step_start': {
                // Update the step status to running
                const stepId = data.stepId as string
                const stepName = data.stepName as string
                const stepIcon = data.stepIcon as string
                setOrchestrationSteps((prev) =>
                  prev.map((s) =>
                    s.id === stepId
                      ? { ...s, status: 'running' as const }
                      : s
                  )
                )
                break
              }

              case 'step_result': {
                const stepId = data.stepId as string
                const duration = data.duration as number | undefined
                setOrchestrationSteps((prev) =>
                  prev.map((s) =>
                    s.id === stepId
                      ? { ...s, status: 'completed' as const, duration }
                      : s
                  )
                )
                break
              }

              case 'step_error': {
                const stepId = data.stepId as string
                const error = data.error as string
                setOrchestrationSteps((prev) =>
                  prev.map((s) =>
                    s.id === stepId
                      ? { ...s, status: 'error' as const, error }
                      : s
                  )
                )
                break
              }

              case 'final_result': {
                const finalContent = data.content as string
                if (finalContent) {
                  fullContent = finalContent
                  setStreamingContent(finalContent)
                }
                receivedToolsUsed = (data.toolsUsed as string[]) || []
                setStreamingToolsUsed(receivedToolsUsed)
                break
              }

              case 'image': {
                const imgUrl = data.url as string
                const imgPrompt = data.prompt as string
                setGeneratedImages(prev => [...prev, { url: imgUrl, prompt: imgPrompt }])
                break
              }

              case 'audio': {
                const audioUrl = data.url as string
                setGeneratedAudioUrl(audioUrl)
                break
              }

              case 'search_results': {
                break
              }

              case 'knowledge_refs': {
                setKnowledgeRefCount(data.count as number || 0)
                setKnowledgeSources((data.sources as string[]) || [])
                break
              }

              case 'memory': {
                break
              }

              case 'done': {
                receivedMessageId = data.messageId as string
                receivedToolsUsed = (data.toolsUsed as string[]) || []

                // Get the final plan from the done event (includes durations and statuses)
                const donePlan = data.plan as { id: string; intent: string; steps: Array<{ id: string; type: string; name: string; icon: string; status: string; duration?: number; error?: string }> } | undefined
                if (donePlan) {
                  receivedPlan = {
                    id: donePlan.id,
                    intent: donePlan.intent,
                    steps: donePlan.steps.map((s) => ({
                      id: s.id,
                      type: s.type,
                      name: s.name,
                      icon: s.icon,
                      status: s.status as OrchestrationPlan['steps'][0]['status'],
                      duration: s.duration,
                      error: s.error,
                    })),
                  }
                }
                break
              }

              case 'error': {
                console.error('Stream error:', data.message)
                if (!fullContent) {
                  fullContent = '抱歉，生成回复时遇到问题。请稍后再试。'
                  setStreamingContent(fullContent)
                }
                break
              }
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const remainingLines = buffer.split('\n')
        for (const line of remainingLines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>
            if (data.type === 'final_result' && data.content) {
              fullContent = data.content as string
              setStreamingContent(fullContent)
            } else if (data.type === 'done') {
              receivedMessageId = data.messageId as string
              receivedToolsUsed = (data.toolsUsed as string[]) || []
            }
          } catch {
            // Skip
          }
        }
      }

      // Add the final assistant message with orchestration plan
      const convId = receivedConversationId || currentConversationId
      const assistantMessage = {
        id: receivedMessageId || `msg-assistant-${Date.now()}`,
        conversationId: convId || '',
        role: 'assistant' as const,
        content: fullContent || '抱歉，我无法生成回复。请稍后再试。',
        model: selectedModelId,
        toolsCalled: receivedToolsUsed.length > 0 ? receivedToolsUsed : (selectedTools.length > 0 ? selectedTools : []),
        memoryRefs: [],
        createdAt: new Date().toISOString(),
        orchestrationPlan: receivedPlan || undefined,
      }
      addMessage(assistantMessage)

      setStreamingContent('')
      setStreamingToolsUsed([])
      setOrchestrationSteps([])
      setOrchestrationPlan(null)
    } catch (err) {
      console.error('Orchestration error, falling back to streaming API:', err)

      // Fallback to the original streaming endpoint
      try {
        const isLocalConversation = currentConversationId?.startsWith('conv-')
        const apiConversationId = isLocalConversation ? undefined : currentConversationId

        const params = new URLSearchParams()
        params.set('message', llmMessage)
        if (apiConversationId) {
          params.set('conversationId', apiConversationId)
        }
        if (selectedTools.length > 0) {
          params.set('tools', selectedTools.join(','))
        }
        params.set('model', selectedModelId)

        const fallbackRes = await fetch(`/api/chat/stream?${params.toString()}`)

        if (!fallbackRes.ok) throw new Error('Fallback request failed')

        const reader = fallbackRes.body?.getReader()
        if (!reader) throw new Error('No readable stream available')

        const decoder = new TextDecoder()
        let buffer = ''
        let fullContent = ''
        let receivedConversationId = ''
        let receivedMessageId = ''
        let receivedToolsUsed: string[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''

          for (const part of parts) {
            const lines = part.split('\n')
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue

              const jsonStr = line.slice(6)
              let data: Record<string, unknown>
              try {
                data = JSON.parse(jsonStr)
              } catch {
                continue
              }

              const eventType = data.type as string

              switch (eventType) {
                case 'conversation': {
                  receivedConversationId = data.conversationId as string
                  if (receivedConversationId && receivedConversationId !== currentConversationId) {
                    setCurrentConversationId(receivedConversationId)
                    const { conversations } = useChatStore.getState()
                    const existingIdx = conversations.findIndex((c) => c.id === currentConversationId)
                    if (existingIdx >= 0) {
                      const updatedConversations = [...conversations]
                      updatedConversations[existingIdx] = {
                        ...updatedConversations[existingIdx],
                        id: receivedConversationId,
                        title: messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent,
                        updatedAt: new Date().toISOString(),
                      }
                      useChatStore.setState({ conversations: updatedConversations })
                    }
                  }
                  break
                }
                case 'token': {
                  const tokenContent = data.content as string
                  fullContent += tokenContent
                  setStreamingContent(fullContent)
                  break
                }
                case 'image': {
                  const imgUrl = data.url as string
                  const imgPrompt = data.prompt as string
                  setGeneratedImages(prev => [...prev, { url: imgUrl, prompt: imgPrompt }])
                  break
                }
                case 'audio': {
                  const audioUrl = data.url as string
                  setGeneratedAudioUrl(audioUrl)
                  break
                }
                case 'done': {
                  receivedMessageId = data.messageId as string
                  receivedToolsUsed = (data.toolsUsed as string[]) || []
                  setStreamingToolsUsed(receivedToolsUsed)
                  break
                }
                case 'error': {
                  console.error('Stream error:', data.message)
                  if (!fullContent) {
                    fullContent = '抱歉，生成回复时遇到问题。请稍后再试。'
                    setStreamingContent(fullContent)
                  }
                  break
                }
              }
            }
          }
        }

        const convId = receivedConversationId || currentConversationId
        const assistantMessage = {
          id: receivedMessageId || `msg-assistant-${Date.now()}`,
          conversationId: convId || '',
          role: 'assistant' as const,
          content: fullContent || '抱歉，我无法生成回复。请稍后再试。',
          model: selectedModelId,
          toolsCalled: receivedToolsUsed.length > 0 ? receivedToolsUsed : (selectedTools.length > 0 ? selectedTools : []),
          memoryRefs: [],
          createdAt: new Date().toISOString(),
        }
        addMessage(assistantMessage)
      } catch (fallbackErr) {
        const errorMessage = {
          id: `msg-error-${Date.now()}`,
          conversationId: currentConversationId || '',
          role: 'assistant' as const,
          content: '抱歉，消息发送失败。请检查网络连接后重试。',
          toolsCalled: [],
          memoryRefs: [],
          createdAt: new Date().toISOString(),
        }
        addMessage(errorMessage)
      }

      setStreamingContent('')
      setStreamingToolsUsed([])
      setOrchestrationSteps([])
      setOrchestrationPlan(null)
    } finally {
      setIsSending(false)
    }
  }, [input, isSending, selectedTools, selectedModelId, currentConversationId, addMessage, setIsSending, setCurrentConversationId, pendingImage])

  // Keep ref in sync
  handleSendRef.current = handleSend

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ASR: Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setIsRecording(false)
        setIsTranscribing(true)

        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const res = await fetch('/api/asr', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            const data = await res.json()
            const transcript = data.text ?? data.transcript ?? ''
            if (transcript) {
              setInput((prev) => prev ? `${prev} ${transcript}` : transcript)
              // Auto-select ASR tool
              if (!selectedTools.includes('asr')) {
                setSelectedTools((prev) => [...prev, 'asr'])
              }
            }
          }
        } catch (err) {
          console.error('ASR transcription error:', err)
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone access error:', err)
    }
  }

  // ASR: Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
  }

  // VLM: Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const base64 = dataUrl.split(',')[1]
      setPendingImage({ dataUrl, base64 })
      // Auto-select VLM tool
      if (!selectedTools.includes('vlm')) {
        setSelectedTools((prev) => [...prev, 'vlm'])
      }
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const charCount = input.length
  const isOverLimit = charCount > MAX_CHARS

  // No conversation selected - welcome screen
  if (!currentConversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-sky-950/30 dark:backdrop-blur-xl dark:border dark:border-sky-500/10">
          <Bot className="h-10 w-10 text-emerald-600 dark:text-sky-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold dark:bg-gradient-to-r dark:from-white dark:via-sky-100 dark:to-white dark:bg-clip-text dark:text-transparent">欢迎使用 AVATAR</h2>
          <p className="mt-2 text-muted-foreground text-sm max-w-md">
            你的个人 AI 智能体助手，可以帮助你管理记忆、执行任务、搜索信息
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 max-w-lg">
          {[
            { text: '帮我总结今天的任务', icon: '📋', desc: '智能整理与规划' },
            { text: '搜索最新的技术动态', icon: '🔍', desc: '实时网络搜索' },
            { text: '回忆上次讨论的要点', icon: '🧠', desc: '从记忆库中检索' },
            { text: '生成一张风景图片', icon: '🎨', desc: 'AI 图像创作' },
          ].map((prompt) => (
            <button
              key={prompt.text}
              onClick={() => {
                const newConvId = `conv-${Date.now()}`
                const { addConversation, setCurrentConversationId } = useChatStore.getState()
                addConversation({
                  id: newConvId,
                  title: '新对话',
                  tags: [],
                  isPinned: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
                setCurrentConversationId(newConvId)
                // Use pendingMessage state to trigger auto-send via useEffect
                setPendingMessage(prompt.text)
              }}
              className="glass-card flex flex-col items-start rounded-xl border px-4 py-3 text-left hover:bg-accent hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-200 min-w-[160px]"
            >
              <span className="text-lg mb-1">{prompt.icon}</span>
              <span className="text-sm font-medium text-foreground">{prompt.text}</span>
              <span className="text-[11px] text-muted-foreground mt-0.5">{prompt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Determine if we should show streaming content vs the old typing indicator
  const isStreaming = isSending && streamingContent.length > 0
  const isThinking = isSending && streamingContent.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-sky-950/50">
            <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">
              {currentConv?.title || '对话'}
            </h3>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-muted-foreground">AVATAR Agent</p>
              <span className="text-[11px] text-muted-foreground/40">·</span>
              {/* Model Selector Popover */}
              <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium hover:bg-muted/60 transition-colors">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      currentModel.pricing === 'free' ? 'bg-emerald-500' :
                      currentModel.pricing === 'premium' ? 'bg-amber-500' : 'bg-sky-500'
                    }`} />
                    <span className="max-w-[80px] truncate">{currentModel.name}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-3 border-b">
                    <Input
                      placeholder={`搜索 ${models.length} 个模型...`}
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <ScrollArea className="max-h-[360px]">
                    <div className="p-2">
                      {/* Recommended models */}
                      {(!modelSearch && models.filter(m => m.recommended).length > 0) && (
                        <div className="mb-2">
                          <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> 推荐模型
                          </p>
                          {models.filter(m => m.recommended).map((m) => (
                            <ModelOption
                              key={m.id}
                              model={m}
                              isSelected={m.id === selectedModelId}
                              onSelect={() => { setSelectedModelId(m.id); setModelPopoverOpen(false); setModelSearch('') }}
                            />
                          ))}
                        </div>
                      )}
                      {/* Models grouped by provider */}
                      {getModelGroups().map((group) => {
                        const GroupIcon = chatProviderIconMap[group.icon] || Bot
                        const groupModels = group.models.filter(m =>
                          !modelSearch ||
                          m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                          m.providerName.includes(modelSearch) ||
                          m.tags.some(t => t.includes(modelSearch))
                        ).filter(m => !(!modelSearch && m.recommended)) // Hide recommended from groups if not searching
                        if (groupModels.length === 0) return null
                        return (
                          <div key={group.provider} className="mb-1">
                            <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                              <GroupIcon className="h-3 w-3" /> {group.providerName}
                            </p>
                            {groupModels.map((m) => (
                              <ModelOption
                                key={m.id}
                                model={m}
                                isSelected={m.id === selectedModelId}
                                onSelect={() => { setSelectedModelId(m.id); setModelPopoverOpen(false); setModelSearch('') }}
                              />
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => useChatStore.getState().clearMessages()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950">
                <Bot className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">开始新对话</p>
                <p className="text-xs text-muted-foreground mt-1">
                  输入消息或选择工具开始
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))
          )}

          {/* Generated images from image_gen tool */}
          {generatedImages.length > 0 && (
            <div className="flex flex-col gap-2 px-4 py-2">
              {generatedImages.map((img, idx) => (
                <div key={idx} className="rounded-xl border bg-card overflow-hidden max-w-md">
                  <img src={img.url} alt={img.prompt} className="w-full" />
                  <div className="p-2 text-xs text-muted-foreground">{img.prompt}</div>
                </div>
              ))}
            </div>
          )}

          {/* Audio player from tts tool */}
          {generatedAudioUrl && (
            <div className="flex items-center gap-2 px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  const audio = new Audio(generatedAudioUrl)
                  audio.onplay = () => setIsPlayingAudio(true)
                  audio.onended = () => setIsPlayingAudio(false)
                  audio.onerror = () => setIsPlayingAudio(false)
                  audio.play().catch(() => setIsPlayingAudio(false))
                }}
                disabled={isPlayingAudio}
              >
                {isPlayingAudio ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                    播放中...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    播放语音
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Orchestration step progress (shown while agent is working) */}
          {isSending && orchestrationSteps.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
                  <Bot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <StepStatusText steps={orchestrationSteps} />
              </div>
              <StepProgress steps={orchestrationSteps} />
            </div>
          )}

          {/* Streaming content */}
          {isStreaming && (
            <div className="flex gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Bot className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex flex-col gap-1 max-w-[75%] min-w-0 items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">AVATAR</span>
                  <span className="text-[10px] text-muted-foreground/60">{currentModel.name}</span>
                </div>
                <div className="glass-card rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed break-words text-card-foreground">
                  <MarkdownRenderer content={streamingContent} />
                  <span className="inline-block w-[2px] h-[14px] ml-[1px] align-middle bg-emerald-500 animate-pulse rounded-full" />
                </div>
                {knowledgeRefCount > 0 && (
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">📚 引用了 {knowledgeRefCount} 条知识</span>
                    {knowledgeSources.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 truncate max-w-[200px]">
                        ({knowledgeSources.join(', ')})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thinking indicator (only shown when no orchestration steps are visible) */}
          {isThinking && orchestrationSteps.length === 0 && (
            <div className="flex gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Bot className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="glass-card flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span className="text-sm text-muted-foreground">正在思考...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-background/80 backdrop-blur-md p-4">
        <div className="flex flex-col gap-2">
          {/* Tool selector row */}
          <div className="flex items-center gap-2">
            <ToolSelector
              selectedTools={selectedTools}
              onToolsChange={setSelectedTools}
            />
          </div>

          {/* Image preview */}
          {pendingImage && (
            <div className="relative inline-flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
              <img
                src={pendingImage.dataUrl}
                alt="待分析图片"
                className="h-16 w-16 rounded-md object-cover"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium">图片已选择</span>
                <span className="text-[10px] text-muted-foreground">发送时将自动分析图片</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 absolute -top-1.5 -right-1.5 rounded-full bg-background border shadow-sm"
                onClick={() => {
                  setPendingImage(null)
                  setSelectedTools((prev) => prev.filter((t) => t !== 'vlm'))
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Textarea + action buttons row */}
          <div className="flex items-end gap-2">
            {/* Action buttons on the left */}
            <div className="flex items-center gap-1 pb-0.5">
              {/* Mic button for ASR */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isSending}
                title={isRecording ? '停止录音' : isTranscribing ? '识别中...' : '语音输入'}
              >
                {isRecording ? (
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <MicOff className="h-4 w-4 text-red-500 relative" />
                  </span>
                ) : isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Mic className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>

              {/* Image upload button for VLM */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => imageInputRef.current?.click()}
                disabled={isSending || !!pendingImage}
                title="上传图片分析"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* Textarea */}
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? '录音中，点击麦克风停止...' : isAnalyzingImage ? '正在分析图片...' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
                  className="min-h-[44px] max-h-[200px] resize-none pr-12 rounded-xl"
                  rows={1}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <span
                    className={`text-[10px] ${
                      isOverLimit ? 'text-destructive' : 'text-muted-foreground/40'
                    }`}
                  >
                    {charCount}/{MAX_CHARS}
                  </span>
                </div>
              </div>
            </div>

            {/* Send button */}
            <Button
              data-send-button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !pendingImage) || isSending || isOverLimit || isAnalyzingImage}
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-9 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
