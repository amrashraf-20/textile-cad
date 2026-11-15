import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-12', className)} aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#16202D" />
      <path d="M10 13h28v4.4H10z" fill="#fff" />
      <path d="M10 21.8h28v4.4H10z" fill="#D92D20" />
      <path d="M10 30.6h28V35H10z" fill="#fff" />
      <path d="M15 13v22M24 13v22M33 13v22" stroke="#16202D" strokeWidth="1.4" />
    </svg>
  )
}

const stages = ['loading.assets', 'loading.workspace', 'loading.account', 'loading.ready']

export function LoadingScreen({ progress, ready }: { progress: number; ready: boolean }) {
  const { t } = useTranslation()
  const stageIndex = Math.min(
    stages.length - 1,
    Math.floor((progress / 100) * (stages.length - 1) + (ready ? 0.35 : 0)),
  )

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app">
      <div className="weave-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-accent/10"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[380px] px-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <LogoMark className="size-14" />
            <span className="absolute -inset-3 -z-10 rounded-2xl bg-accent/5" aria-hidden="true" />
          </div>

          <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
            {t('common.appName')}
          </h1>
          <p className="mt-1 text-[12px] text-muted">{t('common.tagline')}</p>

          <div className="mt-8 w-full">
            <div className="mb-2 flex items-end justify-between">
              <span className="text-[11.5px] text-muted">{t('loading.preparing')}</span>
              <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="h-[3px] w-full overflow-hidden rounded-full bg-[#E7E7E3]"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(2, progress)}%` }}
              />
            </div>
          </div>

          <ul className="mt-6 w-full space-y-1.5 text-start">
            {stages.map((key, i) => (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-2 text-[11.5px] transition-colors',
                  i < stageIndex ? 'text-ink-soft' : i === stageIndex ? 'text-ink' : 'text-muted/50',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full transition-colors',
                    i < stageIndex ? 'bg-success' : i === stageIndex ? 'bg-accent' : 'bg-line-strong',
                  )}
                />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted/70">
          <span className="h-px w-6 bg-line" />
          {t('footer.tagline')}
          <span className="h-px w-6 bg-line" />
        </div>
      </div>
    </div>
  )
}
