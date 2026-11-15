import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  FolderOpen,
  Layers,
  Calculator,
  Sparkles,
  ArrowUpRight,
  Plus,
  Frame,
  TrendingUp,
} from 'lucide-react'

import { Badge, Button, Card, CardHeader, EmptyState, KpiCard, PageHeader, Skeleton } from '@/components/ui'
import { useLocale } from '@/lib/locale'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { cn, formatDate, formatNumber } from '@/lib/utils'
import type { DashboardData } from '@/lib/types'

function DesignTile({
  name,
  meta,
  thumbnail,
  to,
}: {
  name: string
  meta: string
  thumbnail?: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-line hover:bg-surface-muted"
    >
      <div className="size-10 shrink-0 overflow-hidden rounded-[7px] border border-line bg-white">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="weave-grid-bg size-full bg-surface-muted" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-ink group-hover:text-accent">{name}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-muted">{meta}</p>
      </div>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
    </Link>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const locale = useLocale()
  const user = useAuth((s) => s.user)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
  })

  const maxActivity = Math.max(1, ...(data?.activity.map((a) => a.count) ?? [1]))

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <Link to={`/${locale}/app/designs`}>
              <Button variant="secondary" size="md">
                {t('dashboard.viewAll')}
                <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
              </Button>
            </Link>
            <Link to={`/${locale}/app/studio`}>
              <Button size="md">
                <Plus className="size-3.5" />
                {t('dashboard.newDesign')}
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-muted">
          {t('dashboard.welcome', { name: user?.fullName?.split(' ')[0] ?? '' })}
        </p>
        <Badge tone="neutral">
          <span className="size-1.5 rounded-full bg-success" />
          {t('dashboard.thisWeek')}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[108px]" />)
        ) : (
          <>
            <KpiCard
              label={t('dashboard.kpiDesigns')}
              icon={<FolderOpen className="size-3.5" />}
              value={formatNumber(data?.counts.designs ?? 0, locale)}
              delta={<TrendingUp className="size-3" />}
              hint={
                <span>
                  {formatNumber(data?.counts.designs ?? 0, locale)} {t('dashboard.kpiDesignsHint')}
                </span>
              }
            />
            <KpiCard
              label={t('dashboard.kpiYarns')}
              icon={<Layers className="size-3.5" />}
              value={formatNumber(data?.counts.yarns ?? 0, locale)}
              hint={
                <span>
                  {formatNumber(data?.counts.yarns ?? 0, locale)} {t('dashboard.kpiYarnsHint')}
                </span>
              }
            />
            <KpiCard
              label={t('dashboard.kpiQuotes')}
              icon={<Calculator className="size-3.5" />}
              value={formatNumber(data?.counts.quotes ?? 0, locale)}
              hint={
                <span>
                  {formatNumber(data?.counts.quotes ?? 0, locale)} {t('dashboard.kpiQuotesHint')}
                </span>
              }
            />
            <KpiCard
              label={t('dashboard.kpiPlan')}
              icon={<Sparkles className="size-3.5" />}
              value={
                data?.plan.pro ? t('dashboard.pro') : t('dashboard.free')
              }
              delta={
                data?.plan.pro ? (
                  <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    PRO
                  </span>
                ) : (
                  <Link
                    to={`/${locale}/app/settings`}
                    className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  >
                    {t('common.upgrade')}
                  </Link>
                )
              }
              hint={t('dashboard.kpiPlanHint', { grid: data?.plan.gridLimit ?? 16 })}
            />
          </>
        )}
      </div>

      {isError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[12.5px] text-accent">{t('errors.loadFailed')}</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            {t('errors.tryAgain')}
          </Button>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* Activity */}
        <Card>
          <CardHeader
            title={t('dashboard.activity')}
            subtitle={t('dashboard.activitySub')}
            action={
              <Badge tone="neutral">
                {t('dashboard.thisWeek')}
              </Badge>
            }
          />
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-[164px]" />
            ) : (
              <div className="flex h-[164px] items-end gap-2">
                {(data?.activity ?? []).map((point) => {
                  const pct = Math.max(4, (point.count / maxActivity) * 100)
                  return (
                    <div key={point.day} className="group flex flex-1 flex-col items-center gap-2">
                      <span className="text-[10px] font-medium tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">
                        {point.count}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={cn(
                            'w-full rounded-t-[4px] transition-all',
                            point.count > 0 ? 'bg-accent/80 group-hover:bg-accent' : 'bg-[#EDEDE9]',
                          )}
                          style={{ height: `${pct}%` }}
                          title={`${point.day}: ${point.count}`}
                        />
                      </div>
                      <span className="text-[9.5px] text-muted">
                        {new Date(point.day).toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
                          weekday: 'short',
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[10.5px] text-muted">
            <span>{t('dashboard.activitySub')}</span>
            <span className="tabular-nums">
              {formatNumber(data?.activity.reduce((sum, p) => sum + p.count, 0) ?? 0, locale)}{' '}
              {t('dashboard.kpiDesigns')}
            </span>
          </div>
        </Card>

        {/* Plan usage */}
        <Card className="flex flex-col">
          <CardHeader title={t('dashboard.planUsage')} subtitle={t('settings.planDesc')} />
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                <span className="text-muted">{t('dashboard.kpiDesigns')}</span>
                <span className="font-medium text-ink">
                  {t('dashboard.designsUsed', {
                    used: data?.counts.designs ?? 0,
                    limit: data?.plan.designLimit ? data.plan.designLimit : '∞',
                  })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EDEDE9]">
                <div
                  className={cn('h-full rounded-full', data?.plan.pro ? 'bg-success' : 'bg-accent')}
                  style={{
                    width: data?.plan.pro
                      ? '100%'
                      : `${Math.min(100, ((data?.counts.designs ?? 0) / 5) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                <span className="text-muted">{t('studio.grid')}</span>
                <span className="font-medium text-ink">
                  {t('dashboard.gridLimit', { grid: data?.plan.gridLimit ?? 16 })}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EDEDE9]">
                <div
                  className="h-full rounded-full bg-[#23364C]"
                  style={{ width: data?.plan.pro ? '100%' : '16%' }}
                />
              </div>
            </div>

            <div className="mt-auto rounded-lg border border-line bg-surface-muted p-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                <Sparkles className="size-3.5 text-accent" />
                {data?.plan.pro ? t('settings.planPro') : t('common.upgradeTitle')}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted">
                {data?.plan.pro ? t('settings.planFeatureSupport') : t('common.upgradeBody')}
              </p>
              {!data?.plan.pro && (
                <Link to={`/${locale}/app/settings`} className="mt-2 inline-block">
                  <Button size="sm" variant="secondary">
                    {t('common.upgradeCta')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* Recent designs */}
        <Card>
          <CardHeader
            title={t('dashboard.recent')}
            subtitle={t('dashboard.recentSub')}
            action={
              <Link to={`/${locale}/app/designs`}>
                <Button variant="outline" size="sm">
                  {t('common.viewAll')}
                  <ArrowUpRight className="size-3 rtl:-scale-x-100" />
                </Button>
              </Link>
            }
          />
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : data?.recent.length ? (
              <div className="space-y-0.5">
                {data.recent.map((design) => (
                  <DesignTile
                    key={design.id}
                    name={design.name}
                    meta={`${design.warpEnds} × ${design.weftPicks} · ${formatDate(design.updatedAt, locale)}`}
                    thumbnail={design.thumbnail}
                    to={`/${locale}/app/studio/${design.id}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Frame className="size-4" />}
                title={t('dashboard.noDesigns')}
                description={t('dashboard.noDesignsHint')}
                action={
                  <Link to={`/${locale}/app/studio`}>
                    <Button size="sm">
                      <Plus className="size-3.5" />
                      {t('dashboard.createFirst')}
                    </Button>
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title={t('dashboard.quickActions')} />
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {[
              {
                to: `/${locale}/app/studio`,
                icon: <Frame className="size-4" />,
                title: t('dashboard.openStudio'),
                desc: t('dashboard.quickStudioDesc'),
              },
              {
                to: `/${locale}/app/calculations`,
                icon: <Calculator className="size-4" />,
                title: t('dashboard.runCalc'),
                desc: t('dashboard.quickCalcDesc'),
              },
              {
                to: `/${locale}/app/library`,
                icon: <Layers className="size-4" />,
                title: t('dashboard.addYarn'),
                desc: t('dashboard.quickYarnDesc'),
              },
              {
                to: `/${locale}/app/designs`,
                icon: <FolderOpen className="size-4" />,
                title: t('nav.designs'),
                desc: t('dashboard.quickDesignsDesc'),
              },
            ].map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group rounded-lg border border-line bg-white p-3 transition-colors hover:border-line-strong hover:bg-surface-muted"
              >
                <span className="grid size-7 place-items-center rounded-md bg-surface-muted text-ink-soft group-hover:bg-white group-hover:text-accent">
                  {action.icon}
                </span>
                <p className="mt-2 text-[12px] font-medium text-ink">{action.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-4 text-muted">{action.desc}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
