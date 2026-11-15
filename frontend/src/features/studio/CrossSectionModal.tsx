import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Button, Dialog } from '@/components/ui'
import { drawCrossSection, type WeaveSpec } from './simulation'
import { downloadBlob } from '@/lib/utils'

interface CrossSectionModalProps {
  open: boolean
  onClose: () => void
  spec: WeaveSpec
}

export function CrossSectionModal({ open, onClose, spec }: CrossSectionModalProps) {
  const { t } = useTranslation()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const [currentRow, setCurrentRow] = React.useState(0)

  const render = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawCrossSection(canvas, currentRow, spec)
  }, [spec, currentRow])

  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(render, 50)
      return () => clearTimeout(timer)
    }
  }, [open, render])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `cross_section_pick_${currentRow + 1}.png`)
    }, 'image/png')
  }

  const prevRow = () => setCurrentRow((r) => Math.max(0, r - 1))
  const nextRow = () => setCurrentRow((r) => Math.min(spec.weftPicks - 1, r + 1))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.crossSectionTitle', 'المقطع العرضي لمسار الخيوط (Weave Cross Section)')}
      description={t(
        'studio.crossSectionDesc',
        'مخطط هندسي يوضح مسار خيط اللحمة وتموجه (Crimp) فوق وتحت خيوط السداء في كل حذفة.',
      )}
      width="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Row navigation bar */}
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-muted/50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-ink">
              {t('studio.pickRow', 'حذفة اللحمة رقم')}: {currentRow + 1} / {spec.weftPicks}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="icon"
              onClick={prevRow}
              disabled={currentRow === 0}
              aria-label="Previous Pick"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={nextRow}
              disabled={currentRow >= spec.weftPicks - 1}
              aria-label="Next Pick"
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative flex aspect-[21/9] max-h-[360px] w-full items-center justify-center overflow-x-auto rounded-xl border border-line bg-white p-2 shadow-inner">
          <canvas
            ref={canvasRef}
            width={720}
            height={260}
            className="size-full object-contain"
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-full border border-line bg-ink" />
              {t('studio.legendWarp', 'الدوائر: مقطع خيوط السداء')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-4 rounded-full bg-accent" />
              {t('studio.legendWeft', 'الخط المنحني: مسار خيط اللحمة')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.close', 'إغلاق')}
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="size-3.5" />
              {t('common.download', 'تحميل الرسم')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
