'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Smartphone, Monitor, Apple, Chrome, Share, Plus, Download } from 'lucide-react'

const steps = {
  ios: [
    { icon: Chrome, text: '使用 Safari 浏览器打开 SmartLedger' },
    { icon: Share, text: '点击底部的分享按钮 (方框+向上箭头)' },
    { icon: Plus, text: '选择"添加到主屏幕"' },
    { icon: Smartphone, text: '点击"添加"，桌面即可看到 AVATAR 图标' },
  ],
  android: [
    { icon: Chrome, text: '使用 Chrome 浏览器打开 SmartLedger' },
    { icon: Download, text: '等待底部弹出"安装"提示，或点击菜单 ⋮ → "安装应用"' },
    { icon: Plus, text: '点击"安装"按钮' },
    { icon: Smartphone, text: '安装完成后，桌面即可看到 AVATAR 图标' },
  ],
  desktop: [
    { icon: Chrome, text: '使用 Chrome 或 Edge 浏览器打开 SmartLedger' },
    { icon: Download, text: '点击地址栏右侧的安装图标 (⊕) 或菜单 → "安装应用"' },
    { icon: Monitor, text: '点击"安装"按钮' },
    { icon: Smartphone, text: 'AVATAR 将以独立窗口运行，像原生应用一样' },
  ],
}

export function PWAMobileGuide() {
  return (
    <div className="space-y-4">
      {/* iOS Guide */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Apple className="h-5 w-5 text-foreground" />
            iPhone / iPad 安装指南
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.ios.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">{step.text}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Android Guide */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-5 w-5 text-foreground" />
            Android 安装指南
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.android.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">{step.text}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Desktop Guide */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-5 w-5 text-foreground" />
            桌面端安装指南
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.desktop.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">{step.text}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="glass-card border-0 border-emerald-500/10">
        <CardContent className="pt-4">
          <div className="rounded-lg bg-emerald-500/5 p-3">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">💡 使用提示</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• 安装后可全屏使用，像原生APP一样流畅</li>
              <li>• 支持离线缓存，弱网环境也能打开基本页面</li>
              <li>• 外出时可通过 Telegram/飞书 Bot 直接对话</li>
              <li>• PWA自动更新，无需手动下载新版</li>
              <li>• 支持手机麦克风语音输入（需授权）</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
