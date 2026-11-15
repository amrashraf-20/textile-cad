import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Sparkles } from 'lucide-react'
import { Button, Dialog, Field, Select } from '@/components/ui'
import {
  drawRealistic3DFabric,
  type SimulationOptions,
  type WeaveSpec,
} from './simulation'
import { downloadBlob } from '@/lib/utils'

interface SimulationModalProps {
  open: boolean
  onClose: () => void
  spec: WeaveSpec
}

export function SimulationModal({ open, onClose, spec }: SimulationModalProps) {
  const { t } = useTranslation()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  const [options, setOptions] = React.useState<SimulationOptions>({
    zoomLevel: 8,
    yarnMaterial: 'cotton',
    warpTwist: 'Z',
    weftTwist: 'Z',
  })

  const render = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawRealistic3DFabric(canvas, spec, options)
  }, [spec, options])

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
      if (blob) downloadBlob(blob, `fabric_3d_simulation_${Date.now()}.png`)
    }, 'image/png')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.simulationTitle', 'محاكاة القماش ثلاثية الأبعاد (Realistic 3D Simulation)')}
      description={t(
        'studio.simulationDesc',
        'عرض مجهري واقعي لتعرجات الخيوط، إضاءة الألياف، نوع البرمة (Z/S)، وملمس الخامات المختلفة.',
      )}
      width="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Controls Bar */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-muted/50 p-3 sm:grid-cols-4">
          <Field label={t('studio.simMaterial', 'نوع الخامة')}>
            <Select
              value={options.yarnMaterial}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  yarnMaterial: e.target.value as SimulationOptions['yarnMaterial'],
                }))
              }
            >
              <option value="cotton">قطن طبيعي (Cotton)</option>
              <option value="silk">حرير لامع (Silk Sheen)</option>
              <option value="wool">صوف دافئ (Wool Matte)</option>
              <option value="slub">خيوط سلاب (Slub Yarn)</option>
            </Select>
          </Field>

          <Field label={t('studio.simZoom', 'مستوى التكبير')}>
            <Select
              value={String(options.zoomLevel)}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  zoomLevel: Number(e.target.value),
                }))
              }
            >
              <option value="4">4x (نسيج متوسط)</option>
              <option value="8">8x (تكبير قياسي)</option>
              <option value="12">12x (تكبير مجهري)</option>
              <option value="16">16x (ألياف فائقة الدقة)</option>
            </Select>
          </Field>

          <Field label={t('studio.simWarpTwist', 'برمة السداء')}>
            <Select
              value={options.warpTwist}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  warpTwist: e.target.value as 'Z' | 'S',
                }))
              }
            >
              <option value="Z">برمة Z (يمينية)</option>
              <option value="S">برمة S (يسارية)</option>
            </Select>
          </Field>

          <Field label={t('studio.simWeftTwist', 'برمة اللحمة')}>
            <Select
              value={options.weftTwist}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  weftTwist: e.target.value as 'Z' | 'S',
                }))
              }
            >
              <option value="Z">برمة Z (يمينية)</option>
              <option value="S">برمة S (يسارية)</option>
            </Select>
          </Field>
        </div>

        {/* Canvas Display */}
        <div className="relative flex aspect-square max-h-[480px] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-slate-950 shadow-inner sm:aspect-video">
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="size-full object-contain"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <Sparkles className="size-3.5 text-accent" />
            <span>
              {t(
                'studio.simHint',
                'يتم حساب التظليل الأسطواني وانعكاسات الضوء وشعيرات البرم بالملي ثانية.',
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.close', 'إغلاق')}
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="size-3.5" />
              {t('common.download', 'تحميل الصورة (PNG)')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
