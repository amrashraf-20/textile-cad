import * as React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { WeaveThumb } from '@/components/WeaveThumb'
import { useLocale } from '@/lib/locale'
import { generateWeave } from '@/features/studio/weave'
import { LogoMark } from './Loading'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  const preview = React.useMemo(() => {
    const weave = generateWeave(16, 16, { type: 'twill', pattern: '2/2', direction: 'Z' })
    const warp = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? '#D92D20' : '#23364C'))
    const weft = Array.from({ length: 16 }, () => '#F4F1EA')
    return { weave, warp, weft }
  }, [])

  return (
    <div className="grid min-h-screen bg-app lg:grid-cols-[1.02fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar px-10 py-9 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.35) 1px, transparent 1px)',
            backgroundSize: '38px 38px',
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <div className="leading-tight">
            <p className="text-[14px] font-semibold">Textile CAD Studio</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {t('footer.tagline')}
            </p>
          </div>
          <span className="ms-1 mt-3 h-0.5 w-6 rounded-full bg-accent" aria-hidden="true" />
        </div>

        <div className="relative mt-auto max-w-[430px]">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/70">
            <span className="size-1.5 rounded-full bg-success" />
            {t('loading.ready')}
          </p>
          <h2 className="text-[30px] font-semibold leading-[1.2] tracking-[-0.02em]">
            {t('auth.brandHeadline')}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-white/60">{t('auth.brandSub')}</p>

          <ul className="mt-6 space-y-2.5">
            {['auth.brandPoint1', 'auth.brandPoint2', 'auth.brandPoint3'].map((key) => (
              <li key={key} className="flex items-center gap-2.5 text-[12.5px] text-white/75">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] p-3">
            <WeaveThumb
              warpEnds={16}
              weftPicks={16}
              weaveData={preview.weave}
              warpColors={preview.warp}
              weftColors={preview.weft}
              size={56}
              className="border-white/15"
            />
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium text-white/90">2/2 Twill · 16×16</p>
              <p className="mt-0.5 text-[10.5px] text-white/45">
                {t('calc.warpDensity')} 24 · {t('calc.weftDensity')} 20
              </p>
            </div>
            <span className="ms-auto rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">
              Ne 20/1
            </span>
          </div>
        </div>

        <div className="relative mt-8 flex items-center justify-between text-[10.5px] text-white/35">
          <span>
            © {new Date().getFullYear()} Textile CAD Studio
          </span>
          <span>v1.0.0</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:justify-end">
          <Link to={`/${locale}`} className="flex items-center gap-2 lg:hidden">
            <LogoMark className="size-8" />
            <span className="text-[13.5px] font-semibold text-ink">Textile CAD</span>
          </Link>
          <Link
            to={`/${locale}/welcome`}
            className="text-[11.5px] text-muted transition-colors hover:text-ink"
          >
            {t('onboarding.badge')}
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10">
          <div className="w-full max-w-[372px] animate-fade-up">
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-1.5 text-[12.5px] text-muted">{subtitle}</p>
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-5 text-[12px] text-muted">{footer}</div>}
            <p className="mt-8 flex items-center gap-1.5 text-[10.5px] text-muted/80">
              <span className="inline-block size-1.5 rounded-full bg-success" />
              {t('auth.secureNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-[12px] text-accent"
    >
      {children}
    </div>
  )
}
