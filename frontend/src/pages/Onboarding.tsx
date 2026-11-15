import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PencilRuler,
  Sigma,
  Factory,
  ArrowRight,
  ShieldCheck,
  FileDown,
  Grid3x3,
  Check,
} from 'lucide-react'

import { Button, Card } from '@/components/ui'
import { WeaveThumb } from '@/components/WeaveThumb'
import { AppFooter } from '@/components/AppShell'
import { LogoMark } from './Loading'
import { useLocale, useSwitchLocale } from '@/lib/locale'
import { useAuth } from '@/store/auth'
import { generateWeave } from '@/features/studio/weave'
import { cn } from '@/lib/utils'
import type { Locale } from '@/lib/types'

const steps = [
  { icon: <PencilRuler className="size-4" />, title: 'onboarding.step1Title', desc: 'onboarding.step1Desc' },
  { icon: <Sigma className="size-4" />, title: 'onboarding.step2Title', desc: 'onboarding.step2Desc' },
  { icon: <Factory className="size-4" />, title: 'onboarding.step3Title', desc: 'onboarding.step3Desc' },
]

const features = [
  { icon: <Grid3x3 className="size-4" />, title: 'onboarding.featureStudioTitle', desc: 'onboarding.featureStudioDesc' },
  { icon: <Sigma className="size-4" />, title: 'onboarding.featureCalcTitle', desc: 'onboarding.featureCalcDesc' },
  { icon: <FileDown className="size-4" />, title: 'onboarding.featureExportTitle', desc: 'onboarding.featureExportDesc' },
  { icon: <ShieldCheck className="size-4" />, title: 'onboarding.featureSecureTitle', desc: 'onboarding.featureSecureDesc' },
]

export default function Onboarding() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const switchLocale = useSwitchLocale()
  const user = useAuth((s) => s.user)

  const weave = React.useMemo(() => {
    const data = generateWeave(16, 16, { type: 'twill', pattern: '2/2', direction: 'Z' })
    const warp = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? '#D92D20' : '#23364C'))
    const weft = Array.from({ length: 16 }, () => '#F4F1EA')
    return { data, warp, weft }
  }, [])

  const enter = () => {
    const account = useAuth.getState().user
    if (account) localStorage.setItem(`tc_onboarded_${account.id}`, '1')
    navigate(`/${locale}/app/dashboard`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-8" />
          <span className="text-[13.5px] font-semibold text-ink">Textile CAD Studio</span>
          <span className="ms-1 mt-3 hidden h-0.5 w-6 rounded-full bg-accent sm:block" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5">
            {(['ar', 'en'] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchLocale(code)}
                className={cn(
                  'h-6 rounded-[5px] px-2 text-[11px] font-medium transition-colors',
                  locale === code ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                {code === 'ar' ? 'العربية' : 'EN'}
              </button>
            ))}
          </div>
          {user && (
            <Button size="sm" onClick={enter}>
              {t('auth.continueToApp')}
              <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-10 sm:px-8">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">
            <span className="size-1.5 rounded-full bg-accent" />
            {t('onboarding.badge')}
          </span>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <h1 className="max-w-[560px] text-[30px] font-semibold leading-[1.22] tracking-[-0.025em] text-ink sm:text-[34px]">
                {t('onboarding.title')}
              </h1>
              <p className="mt-3 max-w-[540px] text-[13.5px] leading-6 text-muted">
                {t('onboarding.subtitle')}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <Button size="lg" onClick={enter}>
                  {t('onboarding.cta')}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
                <Link to={`/${locale}/app/studio`}>
                  <Button size="lg" variant="secondary">
                    {t('nav.studio')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Draft preview card */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-semibold text-ink">2/2 Twill</p>
                  <p className="mt-0.5 text-[10.5px] text-muted">16 × 16 · Ne 20/1</p>
                </div>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-[#067647]">
                  {t('loading.ready')}
                </span>
              </div>
              <div className="grid place-items-center bg-surface-muted p-5">
                <WeaveThumb
                  warpEnds={16}
                  weftPicks={16}
                  weaveData={weave.data}
                  warpColors={weave.warp}
                  weftColors={weave.weft}
                  size={188}
                  className="shadow-[0_2px_10px_rgba(16,24,40,.06)]"
                />
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[10.5px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent" />
                  {t('studio.warpEnds')} 16
                </span>
                <span>{t('studio.weftPicks')} 16</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {steps.map((step, i) => (
            <Card key={step.title} className="p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface-muted text-ink-soft">
                  {step.icon}
                </span>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-3 text-[13.5px] font-semibold text-ink">{t(step.title)}</h3>
              <p className="mt-1.5 text-[12px] leading-5 text-muted">{t(step.desc)}</p>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="mt-10">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{t('onboarding.featuresTitle')}</h2>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  {feature.icon}
                </span>
                <div>
                  <h3 className="text-[13px] font-semibold text-ink">{t(feature.title)}</h3>
                  <p className="mt-1 text-[11.5px] leading-5 text-muted">{t(feature.desc)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-white px-5 py-4">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <span className="grid size-5 place-items-center rounded-full bg-success-soft text-[#067647]">
              <Check className="size-3" strokeWidth={3} />
            </span>
            {t('onboarding.subtitle')}
          </div>
          <Button onClick={enter}>
            {t('onboarding.cta')}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
