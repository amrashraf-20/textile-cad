import * as React from 'react'
import { cn } from '@/lib/utils'
import { drawWeave } from '@/features/studio/weave'

export interface WeaveThumbProps {
  warpEnds: number
  weftPicks: number
  weaveData: number[][]
  cellColors?: (string | null)[][]
  warpColors: string[]
  weftColors: string[]
  className?: string
  /** Pixel size of the square preview. */
  size?: number
}

/**
 * Renders a design preview. A stored thumbnail (base64 PNG) wins; otherwise the
 * weave is painted on a canvas, which keeps the list fast for large designs.
 */
export function WeaveThumb({
  warpEnds,
  weftPicks,
  weaveData,
  cellColors,
  warpColors,
  weftColors,
  className,
  size = 64,
}: WeaveThumbProps) {
  const ref = React.useRef<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const cell = Math.max(1, Math.floor(size / Math.max(warpEnds, weftPicks)))
    const w = cell * warpEnds
    const h = cell * weftPicks
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, size, size)
    ctx.save()
    ctx.translate((size - w) / 2, (size - h) / 2)
    drawWeave(ctx, { warpEnds, weftPicks, weaveData, cellColors, warpColors, weftColors }, {
      cell,
      gap: 0,
    })
    ctx.restore()
  }, [warpEnds, weftPicks, weaveData, cellColors, warpColors, weftColors, size])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[7px] border border-line bg-white',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />
    </div>
  )
}
