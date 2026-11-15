import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Layers } from 'lucide-react'

import { Button, Dialog, Input } from '@/components/ui'
import { isHexColor } from '@/lib/utils'

export interface ThreadTarget {
  kind: 'warp' | 'weft'
  index: number
  currentColor: string
}

interface ThreadColorModalProps {
  open: boolean
  onClose: () => void
  target: ThreadTarget | null
  onApplySingle: (kind: 'warp' | 'weft', index: number, color: string) => void
  onApplyAll: (kind: 'warp' | 'weft', color: string) => void
}

const TEXTILE_DYES = [
  { nameEn: 'Deep Navy', nameAr: 'كحلي داكن', hex: '#16202D' },
  { nameEn: 'Indigo Denim', nameAr: 'نيلي جينز', hex: '#1F3A5F' },
  { nameEn: 'Crimson Red', nameAr: 'أحمر قرمزي', hex: '#7A1F27' },
  { nameEn: 'Forest Green', nameAr: 'أخضر غابي', hex: '#2C4A3B' },
  { nameEn: 'Mustard Gold', nameAr: 'خردلي ذهبي', hex: '#B98A2E' },
  { nameEn: 'Charcoal Black', nameAr: 'فحمي أسود', hex: '#22262A' },
  { nameEn: 'Natural Ecru', nameAr: 'إيكرو طبيعي', hex: '#F5F2E9' },
  { nameEn: 'Terracotta', nameAr: 'طيني / تيراكوتا', hex: '#A85438' },
  { nameEn: 'Royal Purple', nameAr: 'أرجواني ملكي', hex: '#7E22CE' },
  { nameEn: 'Teal Peacock', nameAr: 'تركواز فيروزي', hex: '#0F766E' },
  { nameEn: 'Greige Sand', nameAr: 'جريج رملي', hex: '#B9B2A6' },
  { nameEn: 'Pure White', nameAr: 'أبيض ناصع', hex: '#FFFFFF' },
]

export function ThreadColorModal({
  open,
  onClose,
  target,
  onApplySingle,
  onApplyAll,
}: ThreadColorModalProps) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language.startsWith('ar')

  const [hex, setHex] = React.useState(target?.currentColor ?? '#1F3A5F')

  React.useEffect(() => {
    if (target?.currentColor) {
      setHex(target.currentColor)
    }
  }, [target])

  if (!target) return null

  const isWarp = target.kind === 'warp'
  const title = isWarp
    ? ar
      ? `تخصيص لون خيط السداء #${target.index + 1}`
      : `Customize Warp End #${target.index + 1} Color`
    : ar
      ? `تخصيص لون حدفة اللحمة #${target.index + 1}`
      : `Customize Weft Pick #${target.index + 1} Color`

  const desc = ar
    ? 'اختر من صبغات النسيج الصناعية القياسية أو أدخل كود اللون (HEX).'
    : 'Choose from industrial textile dye shades or enter a custom hex code.'

  const handleApplySingle = () => {
    if (!isHexColor(hex)) return
    onApplySingle(target.kind, target.index, hex.toUpperCase())
    onClose()
  }

  const handleApplyAll = () => {
    if (!isHexColor(hex)) return
    onApplyAll(target.kind, hex.toUpperCase())
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={desc}
      width="max-w-md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleApplyAll}>
              <Layers className="size-3.5" />
              {isWarp
                ? ar
                  ? 'تطبيق على كل السداء'
                  : 'Apply to All Warp'
                : ar
                  ? 'تطبيق على كل اللحمة'
                  : 'Apply to All Weft'}
            </Button>
            <Button size="sm" onClick={handleApplySingle}>
              <Check className="size-3.5" />
              {ar ? 'تطبيق على هذا الخيط' : 'Apply to This Thread'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Color preview card */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted/50 p-3">
          <div
            className="size-12 shrink-0 rounded-lg border border-line shadow-inner"
            style={{ backgroundColor: hex }}
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isHexColor(hex) ? hex : '#1F3A5F'}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="size-7 cursor-pointer rounded-md border border-line p-0.5"
                title="Color wheel"
              />
              <Input
                value={hex}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                placeholder="#RRGGBB"
                className="font-mono text-[13px] uppercase"
                dir="ltr"
              />
            </div>
            <p className="text-[10.5px] text-muted">
              {ar ? 'الصبغة المختارة حالياً' : 'Current active dye formulation'}
            </p>
          </div>
        </div>

        {/* Industrial Dye Swatches */}
        <div>
          <label className="mb-2 block text-[11.5px] font-semibold text-ink">
            {ar ? 'ألوان الصباغة النسيجية القياسية' : 'Standard Textile Dye Palette'}
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {TEXTILE_DYES.map((dye) => {
              const isSelected = hex.toUpperCase() === dye.hex.toUpperCase()
              return (
                <button
                  key={dye.hex}
                  type="button"
                  onClick={() => setHex(dye.hex)}
                  className={`flex items-center gap-2 rounded-lg border p-1.5 text-start transition ${
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-xs ring-1 ring-accent'
                      : 'border-line bg-white hover:border-line-strong'
                  }`}
                >
                  <span
                    className="size-5 shrink-0 rounded-md border border-black/10"
                    style={{ backgroundColor: dye.hex }}
                  />
                  <div className="overflow-hidden">
                    <p className="truncate text-[11px] font-medium text-ink">
                      {ar ? dye.nameAr : dye.nameEn}
                    </p>
                    <p className="truncate text-[9.5px] font-mono text-muted">{dye.hex}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
