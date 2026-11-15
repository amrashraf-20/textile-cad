import * as React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Link2Off, ShieldCheck, Share2, Layers, Grid3x3 } from 'lucide-react'

import { Badge, Card, Logo, Skeleton } from '@/components/ui'
import { WeaveThumb } from '@/components/WeaveThumb'
import { AppFooter } from '@/components/AppShell'
import { LogoMark } from './Loading'
import { api } from '@/lib/api'
import i18n from '@/lib/i18n'
import { cn, formatDate, formatNumber } from '@/lib/utils'
import type { Locale, SharePayload } from '@/lib/types'

export default function Share() {
  const { t } = useTranslation()
  const token = window.location.pathname.split('/').filter(Boolean).pop() ?? ''
  const locale: Locale = i18n.language === 'en' ? 'en' : 'ar'

  const query = useQuery({
    queryKey: ['public-design', token],
    queryFn: () => api<SharePayload>(`/public/designs/${token}`, {}, false),
    retry: false,
    enabled: token.length > 0,
  })

  React.useEffect(() => {
    if (query.data?.name) document.title = `${query.data.name} · Textile CAD Studio`
    return () => {
      document.title = 'Textile CAD Studio'
    }
  }, [query.data?.name])

  const switchLanguage = (next: Locale) => {
    void i18n.changeLanguage(next)
  }

  const design = query.data

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">
            <Share2 className="size-2.5" />
            {t('share.readOnly')}
          </Badge>
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5">
            {(['ar', 'en'] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => switchLanguage(code)}
                className={cn(
                  'h-6 rounded-[5px] px-2 text-[11px] font-medium transition-colors',
                  locale === code ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
                aria-pressed={locale === code}
              >
                {code === 'ar' ? 'العربية' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8 sm:px-6">
        {query.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <Skeleton className="h-[380px]" />
              <Skeleton className="h-[380px]" />
            </div>
          </div>
        ) : query.isError || !design ? (
          <Card className="mx-auto max-w-md p-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full border border-line bg-surface-muted text-muted">
              <Link2Off className="size-5" />
            </span>
            <h1 className="mt-3 text-[16px] font-semibold text-ink">{t('share.notFoundTitle')}</h1>
            <p className="mt-1 text-[12.5px] text-muted">{t('share.notFoundBody')}</p>
            <Link
              to={`/${locale}`}
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <ArrowLeft className="size-3.5 rtl:rotate-180" />
              {t('share.backHome')}
            </Link>
          </Card>
        ) : (
          <div className="animate-fade-up space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {t('share.sharedDesign')}
                </p>
                <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                  {design.name}
                </h1>
                {design.description && (
                  <p className="mt-1 max-w-xl text-[12.5px] text-muted">{design.description}</p>
                )}
              </div>
              <Badge tone="neutral">v{design.version}</Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                    <Grid3x3 className="size-3.5 text-muted" />
                    {t('share.technicalSheet')}
                  </span>
                  <span className="text-[10.5px] text-muted">
                    {formatDate(design.createdAt, locale)}
                  </span>
                </div>
                <div className="grid place-items-center bg-surface-muted p-6">
                  <WeaveThumb
                    warpEnds={design.warpEnds}
                    weftPicks={design.weftPicks}
                    weaveData={design.weaveData}
                    cellColors={design.cellColors}
                    warpColors={design.warpColors}
                    weftColors={design.weftColors}
                    size={360}
                    className="max-w-full shadow-[0_3px_16px_rgba(16,24,40,.10)]"
                  />
                </div>
                <div className="grid grid-cols-2 divide-x divide-line border-t border-line rtl:divide-x-reverse">
                  <div className="px-4 py-3">
                    <p className="text-[10.5px] text-muted">{t('studio.warpEnds')}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
                      {formatNumber(design.warpEnds, locale)}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10.5px] text-muted">{t('studio.weftPicks')}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
                      {formatNumber(design.weftPicks, locale)}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <div className="border-b border-line px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                      <Layers className="size-3.5 text-muted" />
                      {t('share.palette')}
                    </span>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-muted">
                        {t('share.warp')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {design.warpColors.map((color, index) => (
                          <span
                            key={`w-${index}`}
                            className="size-6 rounded-[5px] border border-black/10"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-muted">
                        {t('share.weft')}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {design.weftColors.map((color, index) => (
                          <span
                            key={`f-${index}`}
                            className="size-6 rounded-[5px] border border-black/10"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                    <ShieldCheck className="size-3.5 text-[#067647]" />
                    {t('share.viewOnly')}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted">{t('share.madeWith')}</p>
                  <Link
                    to={`/${locale}/register`}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong text-[12px] font-medium text-ink transition-colors hover:bg-surface-muted"
                  >
                    {t('share.openStudio')}
                  </Link>
                </Card>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 text-[10.5px] uppercase tracking-[0.16em] text-muted/70">
              <LogoMark className="size-5" />
              {t('share.createdWith')} Textile CAD Studio
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  )
}
