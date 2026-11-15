import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Dialog } from '@/components/ui'
import { draftToMatrix, type WeaveDraft } from './draft'
import { downloadBlob } from '@/lib/utils'

const PAD = 16
const GAP = 12

/**
 * Draws a full industrial draft in the classic four-quadrant layout:
 *
 *   ┌──────────┬────────────┐
 *   │  tie-up  │ threading  │
 *   ├──────────┼────────────┤
 *   │ treadling│   weave    │
 *   └──────────┴────────────┘
 *
 * For lift-plan structures (honeycomb, pile fabrics…) the top-left panel is
 * the peg plan and there is no separate treadling panel.
 */
function drawDraft(
  ctx: CanvasRenderingContext2D,
  draft: WeaveDraft,
  weave: number[][],
  warpEnds: number,
  weftPicks: number,
  warpColors: string[],
  weftColors: string[],
) {
  const ends = Math.min(warpEnds, 48)
  const picks = Math.min(weftPicks, 48)
  const shafts = Math.max(1, draft.shafts)
  const lift = draft.mode === 'liftplan' && draft.liftPlan.length > 0
  const treadles = Math.max(1, lift ? shafts : draft.treadles)
  const unit = Math.max(6, Math.min(18, Math.round(320 / Math.max(shafts, treadles, ends, picks))))

  const tieW = (lift ? shafts : treadles) * unit
  const tieH = (lift ? picks : shafts) * unit
  const threadW = ends * unit
  const threadH = shafts * unit
  const treadW = treadles * unit
  const weaveW = ends * unit
  const weaveH = picks * unit

  const leftW = Math.max(tieW, lift ? 0 : treadW)
  const topH = Math.max(tieH, threadH)

  const width = PAD * 2 + leftW + GAP + weaveW
  const height = PAD * 2 + topH + GAP + weaveH

  ctx.canvas.width = width
  ctx.canvas.height = height
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#F6F6F4'
  ctx.fillRect(PAD, PAD, leftW + GAP + weaveW, topH)
  if (!lift) ctx.fillRect(PAD, PAD + topH + GAP, leftW, weaveH)

  const grid = (
    x: number,
    y: number,
    cols: number,
    rows: number,
    filled: (r: number, c: number) => boolean,
    color: string,
  ) => {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(x, y, cols * unit, rows * unit)
    ctx.fillStyle = color
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!filled(r, c)) continue
        ctx.fillRect(x + c * unit + 1, y + r * unit + 1, unit - 1.5, unit - 1.5)
      }
    }
    ctx.strokeStyle = '#D8D8D3'
    ctx.lineWidth = 1
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath()
      ctx.moveTo(x + c * unit + 0.5, y)
      ctx.lineTo(x + c * unit + 0.5, y + rows * unit)
      ctx.stroke()
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath()
      ctx.moveTo(x, y + r * unit + 0.5)
      ctx.lineTo(x + cols * unit, y + r * unit + 0.5)
      ctx.stroke()
    }
    ctx.strokeStyle = '#B9B9B2'
    ctx.strokeRect(x + 0.5, y + 0.5, cols * unit, rows * unit)
  }

  const tieX = PAD + leftW - tieW
  const tieY = PAD + topH - tieH
  if (lift) {
    grid(
      tieX,
      tieY,
      shafts,
      picks,
      (r, c) => draft.liftPlan[picks - 1 - r]?.[c] === 1,
      '#16202D',
    )
  } else {
    grid(
      tieX,
      tieY,
      treadles,
      shafts,
      (r, c) => draft.tieUp[shafts - 1 - r]?.[c] === 1,
      '#16202D',
    )
  }

  grid(
    PAD + leftW + GAP + weaveW - threadW,
    PAD + topH - threadH,
    ends,
    shafts,
    (r, c) => draft.threading[c % draft.threading.length] === shafts - 1 - r,
    '#D92D20',
  )

  if (!lift) {
    grid(
      PAD,
      PAD + topH + GAP,
      treadles,
      picks,
      (r, c) => draft.treadling[picks - 1 - r] === c,
      '#0F766E',
    )
  }

  const weaveX = PAD + leftW + GAP
  const weaveY = PAD + topH + GAP
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(weaveX, weaveY, weaveW, weaveH)
  for (let r = 0; r < picks; r++) {
    for (let c = 0; c < ends; c++) {
      const up = weave[r]?.[c] === 1
      ctx.fillStyle = up ? warpColors[c] ?? '#23364C' : weftColors[r] ?? '#F5F1E8'
      ctx.fillRect(weaveX + c * unit, weaveY + (picks - 1 - r) * unit, unit - 0.5, unit - 0.5)
    }
  }
  ctx.strokeStyle = '#E4E4E1'
  ctx.strokeRect(weaveX + 0.5, weaveY + 0.5, weaveW, weaveH)
}

export function DraftPlanModal({
  open,
  onClose,
  draft,
  weave,
  warpEnds,
  weftPicks,
  warpColors,
  weftColors,
}: {
  open: boolean
  onClose: () => void
  draft: WeaveDraft | null
  weave: number[][]
  warpEnds: number
  weftPicks: number
  warpColors: string[]
  weftColors: string[]
}) {
  const { t } = useTranslation()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const resolved = React.useMemo<WeaveDraft>(() => {
    if (draft) return draft
    // Derive a peg plan from the design when it has no stored draft (hand-drawn
    // or imported designs). The visible weave stays the source of truth.
    const w = Math.min(warpEnds, 16)
    const h = Math.min(weftPicks, 16)
    const bitmap: number[][] = Array.from({ length: h }, (_, r) =>
      Array.from({ length: w }, (_, c) => (weave[r]?.[c] === 1 ? 1 : 0)),
    )
    return {
      mode: 'liftplan',
      shafts: w,
      treadles: h,
      threading: Array.from({ length: w }, (_, i) => i),
      treadling: Array.from({ length: h }, (_, i) => i),
      tieUp: [],
      liftPlan: bitmap,
      repeatW: w,
      repeatH: h,
    }
  }, [draft, weave, warpEnds, weftPicks])

  React.useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawDraft(ctx, resolved, weave, warpEnds, weftPicks, warpColors, weftColors)
  }, [open, resolved, weave, warpEnds, weftPicks, warpColors, weftColors])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, 'draft-plan.png')
        toast.success(t('common.downloaded'))
      }
    }, 'image/png')
  }

  const matrix = React.useMemo(
    () => draftToMatrix(resolved, Math.min(warpEnds, 16), Math.min(weftPicks, 16)),
    [resolved, warpEnds, weftPicks],
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.draftPlan')}
      description={t('studio.draftPlanHint')}
      width="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button size="sm" onClick={download}>
            <Download className="size-3.5" />
            {t('studio.downloadPng')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          <span className="rounded-md border border-line bg-surface-muted px-2 py-1">
            {resolved.mode === 'liftplan'
              ? t('studio.pegPlan')
              : t('studio.tieUpPlan')}
          </span>
          <span className="rounded-md border border-line bg-surface-muted px-2 py-1">
            {t('studio.shafts')}: {resolved.shafts}
          </span>
          <span className="rounded-md border border-line bg-surface-muted px-2 py-1">
            {t('studio.repeat')}: {resolved.repeatW} × {resolved.repeatH}
          </span>
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-white p-2">
          <canvas ref={canvasRef} className="mx-auto block max-w-full" />
        </div>
        <p className="text-[11px] text-muted">{t('studio.draftLegend')}</p>
        <details className="rounded-lg border border-line bg-surface-muted/60 p-3 text-[11px] text-muted">
          <summary className="cursor-pointer font-medium text-ink">
            {t('studio.exportMatrix')}
          </summary>
          <pre className="mt-2 overflow-auto text-[10px] leading-3" dir="ltr">
            {matrix
              .slice()
              .reverse()
              .map((row) => row.map((v) => (v ? '■' : '·')).join(' '))
              .join('\n')}
          </pre>
        </details>
      </div>
    </Dialog>
  )
}
