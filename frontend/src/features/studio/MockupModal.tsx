import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Armchair, Blinds, Shirt, Box } from 'lucide-react'
import { Button, Dialog, Segmented } from '@/components/ui'
import {
  renderMockup,
  type MockupType,
  type WeaveSpec,
} from './simulation'
import { downloadBlob } from '@/lib/utils'

interface MockupModalProps {
  open: boolean
  onClose: () => void
  spec: WeaveSpec
}

export function MockupModal({ open, onClose, spec }: MockupModalProps) {
  const { t } = useTranslation()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const [type, setType] = React.useState<MockupType>('sofa')
  const [scale, setScale] = React.useState(1.0)

  const render = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderMockup(canvas, type, spec, scale)
  }, [spec, type, scale])

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
      if (blob) downloadBlob(blob, `fabric_mockup_${type}_${Date.now()}.png`)
    }, 'image/png')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.mockupTitle', 'استوديو عرض الموديلات الواقعية (Fabric Mockups)')}
      description={t(
        'studio.mockupDesc',
        'معاينة القماش المنسوج ملبساً على أثاث وملابس وستائر مع الحفاظ على مقياس التكرار والظلال الواقعية.',
      )}
      width="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Model Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented<MockupType>
            value={type}
            onChange={setType}
            options={[
              {
                value: 'sofa',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Armchair className="size-3.5" />
                    {t('studio.mockupSofa', 'كنبة صالون')}
                  </span>
                ),
              },
              {
                value: 'curtain',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Blinds className="size-3.5" />
                    {t('studio.mockupCurtain', 'ستائر بثنيات')}
                  </span>
                ),
              },
              {
                value: 'cushion',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Box className="size-3.5" />
                    {t('studio.mockupCushion', 'مخدة ديكور')}
                  </span>
                ),
              },
              {
                value: 'shirt',
                label: (
                  <span className="flex items-center gap-1.5">
                    <Shirt className="size-3.5" />
                    {t('studio.mockupShirt', 'قميص منسوج')}
                  </span>
                ),
              },
            ]}
          />

          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-ink-soft">
              {t('studio.patternScale', 'مقياس النقشة:')} {scale.toFixed(1)}x
            </span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-28 accent-accent"
            />
          </div>
        </div>

        {/* Canvas Render */}
        <div className="relative flex aspect-video max-h-[460px] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-slate-100 shadow-inner">
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="size-full object-contain"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.close', 'إغلاق')}
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="size-3.5" />
            {t('common.download', 'تحميل الموديل (PNG)')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
