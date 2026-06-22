'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { X, Download, Smartphone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function usePWAState() {
  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
  }, [])

  const isIOS = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
  }, [])

  const wasDismissed = useMemo(() => {
    if (typeof window === 'undefined') return false
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (!dismissed) return false
    const dismissedAt = parseInt(dismissed, 10)
    return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000
  }, [])

  return { isStandalone, isIOS, wasDismissed }
}

export function PWAInstallPrompt() {
  const { isStandalone, isIOS, wasDismissed } = usePWAState()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(!wasDismissed)

  useEffect(() => {
    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a short delay for better UX
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }, [])

  // Don't show if already standalone
  if (isStandalone) return null

  return (
    <AnimatePresence>
      {showPrompt && deferredPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
        >
          <div className="glass-card rounded-2xl border border-emerald-500/20 p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/20">
                <Smartphone className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">安装 SmartLedger 到手机</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {isIOS 
                    ? '点击 Safari 底部的分享按钮 → 选择"添加到主屏幕"'
                    : '一键安装，获得全屏APP体验，离线也可使用'}
                </p>
                <div className="mt-3 flex gap-2">
                  {!isIOS && (
                    <Button
                      size="sm"
                      onClick={handleInstall}
                      className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      立即安装
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    暂不需要
                  </Button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
