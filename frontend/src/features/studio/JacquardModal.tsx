import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Image as ImageIcon, Check } from 'lucide-react'
import { Button, Dialog } from '@/components/ui'
import { processImageToJacquard } from './simulation'
import { toast } from 'sonner'

interface JacquardModalProps {
  open: boolean
  onClose: () => void
  warpEnds: number
  weftPicks: number
  onApply: (data: {
    cellColors: (string | null)[][]
    weaveData: number[][]
  }) => void
}

export function JacquardModal({
  open,
  onClose,
  warpEnds,
  weftPicks,
  onApply,
}: JacquardModalProps) {
  const { t } = useTranslation()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [processed, setProcessed] = React.useState<{
    cellColors: (string | null)[][]
    weaveData: number[][]
  } | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPreviewUrl(URL.createObjectURL(f))
    setIsProcessing(true)

    try {
      const res = await processImageToJacquard(f, warpEnds, weftPicks)
      setProcessed({ cellColors: res.cellColors, weaveData: res.baseWeave })
    } catch {
      toast.error(t('studio.jacquardError', 'تعذر معالجة الصورة'))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleApply = () => {
    if (!processed) return
    onApply(processed)
    toast.success(t('studio.jacquardSuccess', 'تم تحويل الصورة إلى جاكارد وتطبيقها على التصميم!'))
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.jacquardTitle', 'استيراد وتحويل الصور إلى جاكارد (Image to Jacquard)')}
      description={t(
        'studio.jacquardDesc',
        `رفع أي صورة واختزال ألوانها وبكسلتها تلقائياً لتناسب أبعاد النول الحالية (${warpEnds} سداء × ${weftPicks} لحمة).`,
      )}
      width="max-w-xl"
    >
      <div className="space-y-4 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {!previewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface-muted/50 p-8 text-center transition hover:border-accent hover:bg-surface-muted"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Upload className="size-6" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-ink">
                {t('studio.uploadImagePrompt', 'انقر لاختيار صورة من جهازك')}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">PNG, JPG, أو WEBP</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-center">
                <span className="text-[11.5px] font-medium text-ink-soft">
                  {t('studio.originalImage', 'الصورة الأصلية')}
                </span>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-900">
                  <img src={previewUrl} alt="Original" className="size-full object-contain" />
                </div>
              </div>

              <div className="space-y-1.5 text-center">
                <span className="text-[11.5px] font-medium text-ink-soft">
                  {t('studio.jacquardGrid', `بكسلة الجاكارد (${warpEnds}×${weftPicks})`)}
                </span>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-line bg-slate-950 p-1">
                  {processed && (
                    <div
                      className="grid size-full"
                      style={{
                        gridTemplateColumns: `repeat(${warpEnds}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${weftPicks}, minmax(0, 1fr))`,
                      }}
                    >
                      {processed.cellColors.map((row, r) =>
                        row.map((col, c) => (
                          <div
                            key={`${r}-${c}`}
                            style={{ backgroundColor: col ?? '#000000' }}
                            className="size-full"
                          />
                        )),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="size-3.5" />
              {t('studio.changeImage', 'اختيار صورة أخرى')}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', 'إلغاء')}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!processed || isProcessing}
            loading={isProcessing}
          >
            <Check className="size-3.5" />
            {t('studio.applyToCanvas', 'تطبيق على الاستوديو')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
