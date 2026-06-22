'use client'

import React from 'react'
import { Globe, ImageIcon, Volume2, Mic, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolOption {
  id: string
  name: string
  icon: React.ElementType
  description: string
}

const toolOptions: ToolOption[] = [
  { id: 'web_search', name: '网络搜索', icon: Globe, description: '搜索互联网获取最新信息' },
  { id: 'image_gen', name: '图片生成', icon: ImageIcon, description: '根据文字描述生成图片' },
  { id: 'tts', name: '语音合成', icon: Volume2, description: '将文字转换为语音播放' },
  { id: 'asr', name: '语音识别', icon: Mic, description: '将语音转换为文字输入' },
  { id: 'vlm', name: '图片分析', icon: Eye, description: '使用 AI 分析图片内容' },
]

interface ToolSelectorProps {
  selectedTools: string[]
  onToolsChange: (tools: string[]) => void
}

export function ToolSelector({ selectedTools, onToolsChange }: ToolSelectorProps) {
  const toggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter((t) => t !== toolId))
    } else {
      onToolsChange([...selectedTools, toolId])
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {toolOptions.map((tool) => {
        const Icon = tool.icon
        const isSelected = selectedTools.includes(tool.id)
        return (
          <button
            key={tool.id}
            onClick={() => toggleTool(tool.id)}
            title={tool.description}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border',
              isSelected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'
                : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tool.name}
          </button>
        )
      })}
    </div>
  )
}
