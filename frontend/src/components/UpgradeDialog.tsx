import { useTranslation } from 'react-i18next'
import { Sparkles, Grid3x3, Infinity as InfinityIcon, FileDown, Share2, Boxes } from 'lucide-react'
import { Button, Dialog } from './ui'

const features = [
  { icon: <Grid3x3 className="size-4" />, key: 'settings.gridUsage' },
  { icon: <InfinityIcon className="size-4" />, key: 'settings.planFeatureUnlimited' },
  { icon: <FileDown className="size-4" />, key: 'settings.planFeatureWif' },
  { icon: <Boxes className="size-4" />, key: 'settings.planFeatureErp' },
  { icon: <Share2 className="size-4" />, key: 'settings.planFeatureShare' },
]

export function UpgradeDialog({
  open,
  onClose,
  feature,
}: {
  open: boolean
  onClose: () => void
  feature?: string
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('common.upgradeTitle')}
      description={feature ?? t('common.upgradeBody')}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.later')}
          </Button>
          <Button size="sm" onClick={onClose}>
            <Sparkles className="size-3.5" />
            {t('common.upgradeCta')}
          </Button>
        </>
      }
    >
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {features.map((f) => (
          <li
            key={f.key}
            className="flex items-start gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5"
          >
            <span className="mt-0.5 text-accent">{f.icon}</span>
            <span className="text-[12.5px] text-ink-soft">{t(f.key, { grid: 100 })}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] text-muted">{t('settings.upgradeNote')}</p>
    </Dialog>
  )
}
