import * as React from 'react'
import { drawWeave } from './weave'
import type { EditorDoc } from './useEditor'

export type Tool = 'pencil' | 'eraser' | 'line' | 'rect' | 'fill' | 'eyedropper' | 'color'

export interface Guides {
  show: boolean
  every: number
  color: string
  thickness: number
}

const HEADER = 14
const BASE_CELL = 20

function lineCells(start: [number, number], end: [number, number]): [number, number][] {
  const cells: [number, number][] = []
  let [r0, c0] = start
  const [r1, c1] = end
  const dr = Math.abs(r1 - r0)
  const dc = Math.abs(c1 - c0)
  const sr = r0 < r1 ? 1 : -1
  const sc = c0 < c1 ? 1 : -1
  let err = dc - dr
  for (;;) {
    cells.push([r0, c0])
    if (r0 === r1 && c0 === c1) break
    const e2 = 2 * err
    if (e2 > -dr) {
      err -= dr
      c0 += sc
    }
    if (e2 < dc) {
      err += dc
      r0 += sr
    }
  }
  return cells
}

function rectCells(start: [number, number], end: [number, number]): [number, number][] {
  const cells: [number, number][] = []
  const rMin = Math.min(start[0], end[0])
  const rMax = Math.max(start[0], end[0])
  const cMin = Math.min(start[1], end[1])
  const cMax = Math.max(start[1], end[1])
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) cells.push([r, c])
  }
  return cells
}

function floodFill(doc: EditorDoc, r0: number, c0: number): [number, number][] {
  const target = doc.weaveData[r0]?.[c0] === 1 ? 1 : 0
  const seen = new Set<string>()
  const out: [number, number][] = []
  const queue: [number, number][] = [[r0, c0]]
  while (queue.length) {
    const [r, c] = queue.pop() as [number, number]
    if (r < 0 || r >= doc.weftPicks || c < 0 || c >= doc.warpEnds) continue
    const key = `${r}:${c}`
    if (seen.has(key)) continue
    seen.add(key)
    if ((doc.weaveData[r]?.[c] === 1 ? 1 : 0) !== target) continue
    out.push([r, c])
    queue.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1])
  }
  return out
}

export function WeaveCanvas({
  doc,
  tool,
  zoom,
  guides,
  paintColor,
  onApply,
  onPickCell,
  onHeaderClick,
  onHover,
}: {
  doc: EditorDoc
  tool: Tool
  zoom: number
  guides: Guides
  paintColor: string
  onApply: (cells: [number, number][], value: number, color?: string | null) => void
  onPickCell: (r: number, c: number) => void
  onHeaderClick: (kind: 'warp' | 'weft', index: number) => void
  onHover?: (cell: { r: number; c: number } | null) => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const gesture = React.useRef<{
    tool: Tool
    value: number
    start: [number, number]
    last: [number, number]
    color?: string | null
  } | null>(null)
  const [preview, setPreview] = React.useState<[number, number][]>([])
  const [hover, setHover] = React.useState<{ r: number; c: number } | null>(null)

  const cell = Math.max(4, Math.round(BASE_CELL * zoom))
  const width = HEADER + doc.warpEnds * cell
  const height = HEADER + doc.weftPicks * cell

  const cellFromEvent = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left - HEADER
      const y = event.clientY - rect.top - HEADER
      if (x < 0 || y < 0) return null
      const c = Math.floor(x / cell)
      const rFromTop = Math.floor(y / cell)
      const r = doc.weftPicks - 1 - rFromTop
      if (c < 0 || c >= doc.warpEnds || r < 0 || r >= doc.weftPicks) return null
      return { r, c }
    },
    [cell, doc.warpEnds, doc.weftPicks],
  )

  const headerFromEvent = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (y < HEADER && x >= HEADER) {
        const c = Math.floor((x - HEADER) / cell)
        if (c >= 0 && c < doc.warpEnds) return { kind: 'warp' as const, index: c }
      }
      if (x < HEADER && y >= HEADER) {
        const rFromTop = Math.floor((y - HEADER) / cell)
        const r = doc.weftPicks - 1 - rFromTop
        if (r >= 0 && r < doc.weftPicks) return { kind: 'weft' as const, index: r }
      }
      return null
    },
    [cell, doc.warpEnds, doc.weftPicks],
  )

  /* ------------------------------------------------------------- drawing */

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Grid body
    ctx.save()
    ctx.translate(HEADER, HEADER)
    drawWeave(
      ctx,
      {
        warpEnds: doc.warpEnds,
        weftPicks: doc.weftPicks,
        weaveData: doc.weaveData,
        cellColors: doc.cellColors,
        warpColors: doc.warpColors,
        weftColors: doc.weftColors,
      },
      { cell, gap: cell > 7 ? 1 : 0, background: '#FFFFFF' },
    )

    // Guides
    if (guides.show && guides.every > 1) {
      ctx.strokeStyle = guides.color
      ctx.lineWidth = Math.max(1, guides.thickness)
      for (let c = guides.every; c < doc.warpEnds; c += guides.every) {
        ctx.beginPath()
        ctx.moveTo(c * cell, 0)
        ctx.lineTo(c * cell, doc.weftPicks * cell)
        ctx.stroke()
      }
      for (let r = guides.every; r < doc.weftPicks; r += guides.every) {
        const y = doc.weftPicks * cell - r * cell
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(doc.warpEnds * cell, y)
        ctx.stroke()
      }
    }

    // Gesture preview
    if (preview.length) {
      ctx.fillStyle = 'rgba(217,45,32,0.22)'
      for (const [r, c] of preview) {
        const y = (doc.weftPicks - 1 - r) * cell
        ctx.fillRect(c * cell, y, cell - 1, cell - 1)
      }
    }

    // Hover
    if (hover) {
      const y = (doc.weftPicks - 1 - hover.r) * cell
      ctx.strokeStyle = 'rgba(217,45,32,0.85)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(hover.c * cell + 0.75, y + 0.75, cell - 2.5, cell - 2.5)
    }
    ctx.restore()

    // Warp header
    for (let c = 0; c < doc.warpEnds; c++) {
      ctx.fillStyle = doc.warpColors[c] ?? '#CBD5E1'
      ctx.fillRect(HEADER + c * cell, 0, cell - 1, HEADER - 2)
    }
    // Weft header
    for (let r = 0; r < doc.weftPicks; r++) {
      ctx.fillStyle = doc.weftColors[r] ?? '#E2E8F0'
      const y = HEADER + (doc.weftPicks - 1 - r) * cell
      ctx.fillRect(0, y, HEADER - 2, cell - 1)
    }

    // Frame + separators
    ctx.strokeStyle = '#E4E4E1'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(HEADER - 0.5, 0)
    ctx.lineTo(HEADER - 0.5, height)
    ctx.moveTo(0, HEADER - 0.5)
    ctx.lineTo(width, HEADER - 0.5)
    ctx.stroke()
  }, [doc, cell, width, height, guides, preview, hover])

  /* ------------------------------------------------------------ handlers */

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const header = headerFromEvent(event)
    if (header) {
      onHeaderClick(header.kind, header.index)
      return
    }
    const point = cellFromEvent(event)
    if (!point) return
    const { r, c } = point

    if (tool === 'eyedropper') {
      onPickCell(r, c)
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    if (tool === 'fill') {
      const cells = floodFill(doc, r, c)
      const value = doc.weaveData[r]?.[c] === 1 ? 0 : 1
      onApply(cells, value, null)
      return
    }

    if (tool === 'line' || tool === 'rect') {
      const value = doc.weaveData[r]?.[c] === 1 ? 0 : 1
      gesture.current = { tool, value, start: [r, c], last: [r, c], color: null }
      setPreview([[r, c]])
      return
    }

    if (tool === 'color') {
      // Color tool strictly paints the custom cell color without inverting weaveData
      const curVal = doc.weaveData[r]?.[c] === 1 ? 1 : 0
      gesture.current = { tool, value: curVal, start: [r, c], last: [r, c], color: paintColor }
      onApply([[r, c]], curVal, paintColor)
      return
    }

    if (tool === 'eraser') {
      // Eraser clears weave lift to 0 and clears custom color override
      gesture.current = { tool, value: 0, start: [r, c], last: [r, c], color: null }
      onApply([[r, c]], 0, null)
      return
    }

    // Pencil tool: toggles weaveData lift and clears color override
    const nextVal = doc.weaveData[r]?.[c] === 1 ? 0 : 1
    gesture.current = { tool, value: nextVal, start: [r, c], last: [r, c], color: null }
    onApply([[r, c]], nextVal, null)
  }

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = cellFromEvent(event)
    if (!hover || (point && (point.r !== hover.r || point.c !== hover.c)) || (!point && hover)) {
      setHover(point)
      onHover?.(point)
    }

    const g = gesture.current
    if (!g) return

    if (g.tool === 'line' || g.tool === 'rect') {
      if (!point) return
      g.last = [point.r, point.c]
      setPreview(g.tool === 'line' ? lineCells(g.start, g.last) : rectCells(g.start, g.last))
      return
    }

    if (!point) return
    if (point.r === g.last[0] && point.c === g.last[1]) return
    g.last = [point.r, point.c]
    if (g.tool === 'color') {
      const cur = doc.weaveData[point.r]?.[point.c] === 1 ? 1 : 0
      onApply([[point.r, point.c]], cur, g.color)
    } else {
      onApply([[point.r, point.c]], g.value, g.color)
    }
  }

  const handleUp = () => {
    const g = gesture.current
    if (!g) return
    if ((g.tool === 'line' || g.tool === 'rect') && preview.length) {
      onApply(preview, g.value, null)
    }
    gesture.current = null
    setPreview([])
  }

  const handleLeave = () => {
    setHover(null)
    onHover?.(null)
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={handleLeave}
      className="touch-none select-none"
      style={{
        width,
        height,
        cursor: tool === 'eyedropper' ? 'crosshair' : 'cell',
      }}
      aria-label="Weave editor canvas"
      role="img"
    />
  )
}
