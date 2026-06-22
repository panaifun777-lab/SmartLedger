'use client'

import React, { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

/**
 * WaterFlowBackground - Canvas-based realistic water surface with ripples and caustics
 * Creates a dynamic, clearly visible water flow effect.
 * Only renders in dark mode.
 */
export function FlowingBackground() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!isDark || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let width = 0
    let height = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }
    resize()
    window.addEventListener('resize', resize)

    let time = 0

    // Ripple pool
    const ripples: Array<{
      x: number; y: number; radius: number; maxRadius: number; opacity: number; speed: number
    }> = []

    // Seed initial ripples
    for (let i = 0; i < 6; i++) {
      ripples.push({
        x: Math.random() * (width || 1),
        y: Math.random() * (height || 1),
        radius: Math.random() * 80,
        maxRadius: 180 + Math.random() * 280,
        opacity: 0.08 + Math.random() * 0.12,
        speed: 0.4 + Math.random() * 0.6,
      })
    }

    let spawnTimer = 0

    const draw = () => {
      time += 0.006
      spawnTimer += 0.006

      // ── 1. Base deep ocean gradient ──
      const baseGrad = ctx.createLinearGradient(0, 0, width * 0.3, height)
      baseGrad.addColorStop(0, '#010a18')
      baseGrad.addColorStop(0.2, '#051a35')
      baseGrad.addColorStop(0.45, '#0a2a4a')
      baseGrad.addColorStop(0.7, '#072240')
      baseGrad.addColorStop(1, '#020e20')
      ctx.fillStyle = baseGrad
      ctx.fillRect(0, 0, width, height)

      // ── 2. Large flowing water bodies ──
      const drawBlob = (
        cx: number, cy: number, rw: number, rh: number,
        r: number, g: number, b: number, alpha: number, phase: number
      ) => {
        const ox = Math.sin(time * 0.4 + phase) * rw * 0.18
        const oy = Math.cos(time * 0.25 + phase * 0.7) * rh * 0.12
        const scale = 1 + Math.sin(time * 0.3 + phase) * 0.08
        const grad = ctx.createRadialGradient(
          cx + ox, cy + oy, 0,
          cx + ox, cy + oy, Math.max(1, Math.max(rw, rh) * scale)
        )
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
        grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`)
        grad.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(cx + ox, cy + oy, Math.max(1, rw * scale), Math.max(1, rh * scale), Math.sin(time * 0.15 + phase) * 0.15, 0, Math.PI * 2)
        ctx.fill()
      }

      // Primary water masses - HIGH opacity for visibility
      drawBlob(width * 0.25, height * 0.25, width * 0.55, height * 0.4, 14, 116, 144, 0.35, 0)
      drawBlob(width * 0.75, height * 0.55, width * 0.5, height * 0.35, 56, 189, 248, 0.25, 2)
      drawBlob(width * 0.45, height * 0.75, width * 0.45, height * 0.3, 3, 105, 161, 0.30, 4)
      drawBlob(width * 0.1, height * 0.6, width * 0.35, height * 0.25, 8, 69, 105, 0.22, 1)
      drawBlob(width * 0.85, height * 0.2, width * 0.3, height * 0.2, 14, 165, 233, 0.18, 3)

      // ── 3. Bright caustic light spots ──
      const drawCaustic = (
        cx: number, cy: number, size: number, alpha: number, phase: number
      ) => {
        const ox = Math.sin(time * 0.7 + phase) * size * 0.35
        const oy = Math.cos(time * 0.5 + phase * 1.2) * size * 0.25
        const pulse = alpha * (0.5 + 0.5 * Math.sin(time * 1.0 + phase))
        const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, Math.max(1, size))
        grad.addColorStop(0, `rgba(186, 230, 253, ${pulse * 1.5})`)
        grad.addColorStop(0.2, `rgba(125, 211, 252, ${pulse})`)
        grad.addColorStop(0.5, `rgba(56, 189, 248, ${pulse * 0.3})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(cx + ox, cy + oy, Math.max(1, size * 1.8), Math.max(1, size), Math.sin(time * 0.35 + phase) * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }

      // Bright caustic spots - HIGH opacity
      drawCaustic(width * 0.3, height * 0.15, 140, 0.18, 0)
      drawCaustic(width * 0.65, height * 0.35, 120, 0.15, 1.5)
      drawCaustic(width * 0.45, height * 0.5, 100, 0.12, 3)
      drawCaustic(width * 0.8, height * 0.4, 90, 0.13, 4.5)
      drawCaustic(width * 0.15, height * 0.6, 80, 0.10, 2)
      drawCaustic(width * 0.55, height * 0.8, 110, 0.09, 5.5)
      drawCaustic(width * 0.9, height * 0.7, 70, 0.08, 6)

      // ── 4. Water ripple circles ──
      ctx.save()
      for (const ripple of ripples) {
        ripple.radius += ripple.speed
        if (ripple.radius > ripple.maxRadius) {
          ripple.radius = 0
          ripple.x = Math.random() * width
          ripple.y = Math.random() * height
          ripple.opacity = 0.08 + Math.random() * 0.12
        }
        const progress = ripple.radius / ripple.maxRadius
        const currentOpacity = ripple.opacity * (1 - progress) * Math.sin(progress * Math.PI)

        // Outer ring
        ctx.beginPath()
        ctx.arc(ripple.x, ripple.y, Math.max(1, ripple.radius), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(125, 211, 252, ${currentOpacity})`
        ctx.lineWidth = 2
        ctx.stroke()

        // Middle ring
        if (ripple.radius > 30) {
          ctx.beginPath()
          ctx.arc(ripple.x, ripple.y, Math.max(1, ripple.radius * 0.65), 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(56, 189, 248, ${currentOpacity * 0.6})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Inner ring
        if (ripple.radius > 60) {
          ctx.beginPath()
          ctx.arc(ripple.x, ripple.y, Math.max(1, ripple.radius * 0.35), 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(186, 230, 253, ${currentOpacity * 0.3})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Spawn new ripple
      if (spawnTimer > 1.5) {
        spawnTimer = 0
        if (ripples.length < 12) {
          ripples.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 0,
            maxRadius: 150 + Math.random() * 250,
            opacity: 0.08 + Math.random() * 0.12,
            speed: 0.4 + Math.random() * 0.6,
          })
        }
      }
      ctx.restore()

      // ── 5. Horizontal wave lines ──
      ctx.save()
      ctx.globalAlpha = 0.06
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)'
      ctx.lineWidth = 0.8
      for (let y = 0; y < height; y += 6) {
        ctx.beginPath()
        const offset = Math.sin(y * 0.015 + time * 1.8) * 4
        ctx.moveTo(0, y + offset)
        for (let x = 0; x < width; x += 15) {
          const wave = Math.sin(x * 0.004 + y * 0.008 + time * 1.2) * 3
          ctx.lineTo(x, y + offset + wave)
        }
        ctx.stroke()
      }
      ctx.restore()

      // ── 6. Bright specular highlights (like moonlight on water) ──
      const drawSpecular = (cx: number, cy: number, w: number, h: number, alpha: number, phase: number) => {
        const ox = Math.sin(time * 0.6 + phase) * w * 0.2
        const oy = Math.cos(time * 0.4 + phase) * h * 0.15
        const pulse = alpha * (0.3 + 0.7 * Math.pow(Math.sin(time * 0.8 + phase), 2))
        ctx.save()
        ctx.globalAlpha = pulse
        const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, Math.max(1, Math.max(w, h)))
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)')
        grad.addColorStop(0.15, 'rgba(186, 230, 253, 0.2)')
        grad.addColorStop(0.4, 'rgba(125, 211, 252, 0.06)')
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(cx + ox, cy + oy, Math.max(1, w), Math.max(1, h * 0.4), Math.sin(time * 0.2 + phase) * 0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      drawSpecular(width * 0.35, height * 0.18, 200, 80, 0.12, 0)
      drawSpecular(width * 0.6, height * 0.4, 160, 60, 0.09, 2)
      drawSpecular(width * 0.2, height * 0.55, 130, 50, 0.07, 4)

      // ── 7. Side vignette for depth ──
      const vigGrad = ctx.createRadialGradient(
        width * 0.5, height * 0.5, Math.min(width, height) * 0.25,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.75
      )
      vigGrad.addColorStop(0, 'transparent')
      vigGrad.addColorStop(1, 'rgba(1, 6, 16, 0.55)')
      ctx.fillStyle = vigGrad
      ctx.fillRect(0, 0, width, height)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [isDark])

  if (!isDark) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Top edge light - cyan water reflection */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.20) 15%, rgba(125, 211, 252, 0.35) 50%, rgba(56, 189, 248, 0.20) 85%, transparent 100%)',
        }}
      />

      {/* Bottom edge subtle glow */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(14, 165, 233, 0.10) 25%, rgba(3, 105, 161, 0.18) 50%, rgba(14, 165, 233, 0.10) 75%, transparent 100%)',
        }}
      />
    </div>
  )
}
