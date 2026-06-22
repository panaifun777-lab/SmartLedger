'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useMemoryStore, type MemoryType, type MemoryItem, type MemoryRelation } from '@/stores'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Brain,
  ArrowUpDown,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  memory: MemoryItem
  radius: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  relation: MemoryRelation
}

// ─── Color maps ───────────────────────────────────────────────────

const nodeColors: Record<string, string> = {
  fact: '#3b82f6',       // blue-500
  preference: '#ec4899', // pink-500
  skill: '#10b981',      // emerald-500
  context: '#f59e0b',    // amber-500
  rule: '#8b5cf6',       // violet-500
  event: '#64748b',      // slate-500
}

const nodeColorsDark: Record<string, string> = {
  fact: '#60a5fa',       // blue-400
  preference: '#f472b6', // pink-400
  skill: '#34d399',      // emerald-400
  context: '#fbbf24',    // amber-400
  rule: '#a78bfa',       // violet-400
  event: '#94a3b8',      // slate-400
}

const edgeColors: Record<string, string> = {
  related_to: '#9ca3af',  // gray-400
  supports: '#34d399',    // emerald-400
  contradicts: '#f87171', // red-400
  derived_from: '#fbbf24', // amber-400
}

const typeLabels: Record<string, string> = {
  fact: '事实',
  preference: '偏好',
  skill: '技能',
  context: '上下文',
  rule: '规则',
  event: '事件',
}

const relationLabels: Record<string, string> = {
  related_to: '关联',
  supports: '支持',
  contradicts: '矛盾',
  derived_from: '来源',
}

// ─── Force Simulation ─────────────────────────────────────────────

function simulateForces(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  alpha: number
): number {
  const centerX = width / 2
  const centerY = height / 2

  // Reset forces
  for (const node of nodes) {
    node.vx = 0
    node.vy = 0
  }

  // Center gravity
  for (const node of nodes) {
    node.vx += (centerX - node.x) * 0.01 * alpha
    node.vy += (centerY - node.y) * 0.01 * alpha
  }

  // Repulsion between nodes (Coulomb's law)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const minDist = nodes[i].radius + nodes[j].radius + 30
      const force = (800 * alpha) / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      nodes[i].vx -= fx
      nodes[i].vy -= fy
      nodes[j].vx += fx
      nodes[j].vy += fy

      // Collision avoidance
      if (dist < minDist) {
        const overlap = (minDist - dist) * 0.5 * alpha
        nodes[i].vx -= (dx / dist) * overlap
        nodes[i].vy -= (dy / dist) * overlap
        nodes[j].vx += (dx / dist) * overlap
        nodes[j].vy += (dy / dist) * overlap
      }
    }
  }

  // Attraction along edges (Hooke's law)
  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source)
    const target = nodes.find((n) => n.id === edge.target)
    if (!source || !target) continue

    const dx = target.x - source.x
    const dy = target.y - source.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const idealDist = 120
    const force = (dist - idealDist) * 0.005 * alpha
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    source.vx += fx
    source.vy += fy
    target.vx -= fx
    target.vy -= fy
  }

  // Apply velocity with damping
  let totalMovement = 0
  for (const node of nodes) {
    node.vx *= 0.6
    node.vy *= 0.6
    node.x += node.vx
    node.y += node.vy

    // Keep in bounds with padding
    const padding = node.radius + 20
    node.x = Math.max(padding, Math.min(width - padding, node.x))
    node.y = Math.max(padding, Math.min(height - padding, node.y))

    totalMovement += Math.abs(node.vx) + Math.abs(node.vy)
  }

  return totalMovement
}

// ─── Component ────────────────────────────────────────────────────

interface MemoryGraphProps {
  onNodeClick?: (memoryId: string) => void
  selectedMemoryId?: string | null
  filterType?: string
}

export function MemoryGraph({ onNodeClick, selectedMemoryId, filterType = 'all' }: MemoryGraphProps) {
  const { memories, memoryRelations } = useMemoryStore()
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredNodeData, setHoveredNodeData] = useState<GraphNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([])
  const [visibleRelationTypes, setVisibleRelationTypes] = useState<Set<string>>(
    new Set(['related_to', 'supports', 'contradicts', 'derived_from'])
  )
  const [isDark, setIsDark] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const animFrameRef = useRef<number>(0)
  const isDraggingRef = useRef(false)
  const dragNodeRef = useRef<string | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const nodesRef = useRef<GraphNode[]>([])

  // Check dark mode
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Load relations on mount
  useEffect(() => {
    const loadRelations = async () => {
      try {
        const res = await fetch('/api/memory?limit=100&status=active')
        if (res.ok) {
          setIsLoading(false)
        }
      } catch {
        setIsLoading(false)
      }
    }
    loadRelations()
  }, [])

  // Build graph data when memories/relations change
  const graphData = useMemo(() => {
    const width = containerRef.current?.clientWidth || 800
    const height = containerRef.current?.clientHeight || 600

    const filtered = filterType === 'all'
      ? memories
      : memories.filter((m) => m.memoryType === filterType)

    const nodes: GraphNode[] = filtered.map((m, i) => {
      // Place in a circle initially
      const angle = (2 * Math.PI * i) / Math.max(filtered.length, 1)
      const spread = Math.min(width, height) * 0.35
      return {
        id: m.id,
        x: width / 2 + Math.cos(angle) * spread * (0.8 + Math.random() * 0.4),
        y: height / 2 + Math.sin(angle) * spread * (0.8 + Math.random() * 0.4),
        vx: 0,
        vy: 0,
        memory: m,
        radius: 8 + m.importance * 16, // 8-24px based on importance
      }
    })

    // Build edges - use stored relations, plus auto-detect same-type connections
    const edges: GraphEdge[] = []
    const nodeIds = new Set(nodes.map((n) => n.id))

    // Use actual relations from store
    for (const rel of memoryRelations) {
      if (nodeIds.has(rel.fromMemoryId) && nodeIds.has(rel.toMemoryId)) {
        edges.push({
          id: rel.id,
          source: rel.fromMemoryId,
          target: rel.toMemoryId,
          relation: rel,
        })
      }
    }

    return { nodes, edges }
  }, [memories, memoryRelations, filterType])

  // Sync graph data to state
  useEffect(() => {
    const { nodes, edges } = graphData
    nodesRef.current = nodes
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(() => {
      setGraphNodes(nodes)
      setGraphEdges(edges)
    })
  }, [graphData])

  // Force simulation loop
  useEffect(() => {
    if (graphNodes.length === 0) return

    let alpha = 1.0
    const width = containerRef.current?.clientWidth || 800
    const height = containerRef.current?.clientHeight || 600

    const tick = () => {
      alpha *= 0.995 // Decay alpha
      if (alpha < 0.001) alpha = 0.001

      const totalMovement = simulateForces(
        nodesRef.current,
        graphEdges,
        width,
        height,
        alpha
      )

      setGraphNodes([...nodesRef.current])

      // Stop simulation when movement is negligible
      if (totalMovement > 0.1 || alpha > 0.01) {
        animFrameRef.current = requestAnimationFrame(tick)
      }
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [graphEdges, graphNodes.length])

  // Handle node drag (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    dragNodeRef.current = nodeId
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Handle SVG background click for panning
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) return
    isPanningRef.current = true
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current && dragNodeRef.current) {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left - pan.x) / zoom
      const y = (e.clientY - rect.top - pan.y) / zoom

      const node = nodesRef.current.find((n) => n.id === dragNodeRef.current)
      if (node) {
        node.x = x
        node.y = y
        node.vx = 0
        node.vy = 0
        setGraphNodes([...nodesRef.current])

        // Restart simulation with low alpha
        cancelAnimationFrame(animFrameRef.current)
        let alpha = 0.3
        const width = containerRef.current?.clientWidth || 800
        const height = containerRef.current?.clientHeight || 600
        const tick = () => {
          alpha *= 0.99
          simulateForces(nodesRef.current, graphEdges, width, height, alpha)
          setGraphNodes([...nodesRef.current])
          if (alpha > 0.01) {
            animFrameRef.current = requestAnimationFrame(tick)
          }
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }
    } else if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      })
    }
  }, [zoom, pan, graphEdges])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    dragNodeRef.current = null
    isPanningRef.current = false
  }, [])

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent, nodeId: string) => {
    e.stopPropagation()
    isDraggingRef.current = true
    dragNodeRef.current = nodeId
    const touch = e.touches[0]
    dragStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDraggingRef.current && dragNodeRef.current) {
      e.preventDefault()
      const touch = e.touches[0]
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (touch.clientX - rect.left - pan.x) / zoom
      const y = (touch.clientY - rect.top - pan.y) / zoom

      const node = nodesRef.current.find((n) => n.id === dragNodeRef.current)
      if (node) {
        node.x = x
        node.y = y
        node.vx = 0
        node.vy = 0
        setGraphNodes([...nodesRef.current])
      }
    }
  }, [zoom, pan])

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false
    dragNodeRef.current = null
  }, [])

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.2))
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2))
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Toggle relation type visibility
  const toggleRelationType = (type: string) => {
    setVisibleRelationTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Filtered edges based on visible relation types
  const visibleEdges = useMemo(
    () => graphEdges.filter((e) => visibleRelationTypes.has(e.relation.relationType)),
    [graphEdges, visibleRelationTypes]
  )

  // Stats
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const node of graphNodes) {
      counts[node.memory.memoryType] = (counts[node.memory.memoryType] || 0) + 1
    }
    return counts
  }, [graphNodes])

  const edgeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const edge of graphEdges) {
      counts[edge.relation.relationType] = (counts[edge.relation.relationType] || 0) + 1
    }
    return counts
  }, [graphEdges])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    )
  }

  if (graphNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Brain className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">暂无记忆数据</p>
        <p className="text-xs text-muted-foreground/60">添加记忆后可查看知识图谱</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Brain className="h-3 w-3" />
            {graphNodes.length} 节点
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {visibleEdges.length} 连接
          </Badge>

          {/* Node type legend */}
          {Object.entries(nodeTypeCounts).map(([type, count]) => (
            <TooltipProvider key={type}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: isDark ? nodeColorsDark[type] : nodeColors[type] }}
                    />
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{typeLabels[type]}: {count}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {/* Relation type filters */}
          {Object.entries(edgeTypeCounts).map(([type, count]) => (
            <Button
              key={type}
              variant={visibleRelationTypes.has(type) ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 gap-1 text-[10px] px-2"
              onClick={() => toggleRelationType(type)}
            >
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: edgeColors[type] }}
              />
              {relationLabels[type]} {count}
              {visibleRelationTypes.has(type) ? (
                <Eye className="h-2.5 w-2.5" />
              ) : (
                <EyeOff className="h-2.5 w-2.5" />
              )}
            </Button>
          ))}

          <div className="w-px h-4 bg-border mx-1" />

          {/* Zoom controls */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Graph Canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {visibleEdges.map((edge) => {
              const source = graphNodes.find((n) => n.id === edge.source)
              const target = graphNodes.find((n) => n.id === edge.target)
              if (!source || !target) return null

              const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target

              return (
                <line
                  key={edge.id}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={edgeColors[edge.relation.relationType] || '#9ca3af'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isHighlighted ? 0.8 : 0.3}
                  strokeDasharray={edge.relation.relationType === 'contradicts' ? '4,4' : undefined}
                />
              )
            })}

            {/* Nodes */}
            {graphNodes.map((node) => {
              const color = isDark
                ? nodeColorsDark[node.memory.memoryType] || '#94a3b8'
                : nodeColors[node.memory.memoryType] || '#64748b'
              const isHovered = hoveredNode === node.id
              const isSelected = selectedMemoryId === node.id
              const isCore = node.memory.metadata?.core === true

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onTouchStart={(e) => handleTouchStart(e, node.id)}
                  onMouseEnter={() => {
                    setHoveredNode(node.id)
                    setHoveredNodeData(node)
                    // Calculate tooltip position
                    const rect = containerRef.current?.getBoundingClientRect()
                    const containerWidth = rect?.width || 800
                    const leftPos = Math.min(
                      node.x * zoom + pan.x + 20,
                      containerWidth - 260
                    )
                    const topPos = Math.max(10, node.y * zoom + pan.y - 40)
                    setTooltipPos({ x: leftPos, y: topPos })
                  }}
                  onMouseLeave={() => {
                    setHoveredNode(null)
                    setHoveredNodeData(null)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onNodeClick?.(node.id)
                  }}
                  className="cursor-pointer"
                >
                  {/* Outer glow for hovered/selected */}
                  {(isHovered || isSelected) && (
                    <circle
                      r={node.radius + 4}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeOpacity={0.5}
                    />
                  )}

                  {/* Core memory indicator ring */}
                  {isCore && (
                    <circle
                      r={node.radius + 2}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="2,2"
                      strokeOpacity={0.4}
                    />
                  )}

                  {/* Main circle */}
                  <circle
                    r={node.radius}
                    fill={color}
                    fillOpacity={isHovered ? 1 : 0.7}
                    stroke={isSelected ? color : 'white'}
                    strokeWidth={isSelected ? 2.5 : 1}
                    className="transition-all duration-150"
                  />

                  {/* Type initial */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-white text-[8px] font-bold pointer-events-none select-none"
                    style={{ fontSize: Math.max(8, node.radius * 0.7) }}
                  >
                    {typeLabels[node.memory.memoryType]?.[0] || '?'}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredNode && hoveredNodeData && (
          <div
            className="absolute pointer-events-none rounded-lg border bg-card p-3 shadow-lg max-w-[240px] z-50"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isDark ? nodeColorsDark[hoveredNodeData.memory.memoryType] : nodeColors[hoveredNodeData.memory.memoryType] }}
              />
              <Badge variant="secondary" className="text-[9px] h-4">
                {typeLabels[hoveredNodeData.memory.memoryType]}
              </Badge>
              {hoveredNodeData.memory.metadata?.core ? (
                <Badge variant="secondary" className="text-[9px] h-4 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  核心
                </Badge>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed line-clamp-3">{hoveredNodeData.memory.content}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
              <span>重要性: {Math.round(hoveredNodeData.memory.importance * 100)}%</span>
              <span>·</span>
              <span>置信度: {Math.round(hoveredNodeData.memory.confidence * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
