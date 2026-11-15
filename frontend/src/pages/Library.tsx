import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Layers,
  Pencil,
  Trash2,
  RefreshCw,
  TrendingUp,
  Package,
  Globe2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
} from '@/components/ui'
import { UpgradeDialog } from '@/components/UpgradeDialog'
import { api, ApiError } from '@/lib/api'
import { useLocale } from '@/lib/locale'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import type { Rate, Yarn } from '@/lib/types'

type Filter = 'all' | 'mine' | 'global'

interface YarnForm {
  name: string
  system: 'ne' | 'tex' | 'denier'
  count: string
  material: string
  priceEgp: string
}

const emptyForm: YarnForm = {
  name: '',
  system: 'ne',
  count: '',
  material: '',
  priceEgp: '',
}

function systemLabel(system: Yarn['system']) {
  if (system === 'ne') return 'Ne'
  if (system === 'tex') return 'Tex'
  return 'Denier'
}

export default function Library() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()

  const [filter, setFilter] = React.useState<Filter>('all')
  const [query, setQuery] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Yarn | null>(null)
  const [form, setForm] = React.useState<YarnForm>(emptyForm)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<Yarn | null>(null)
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)

  const yarnsQuery = useQuery({
    queryKey: ['yarns'],
    queryFn: () => api<{ items: Yarn[] }>('/yarns'),
  })

  const ratesQuery = useQuery({
    queryKey: ['rates'],
    queryFn: () => api<{ items: Rate[] }>('/rates'),
  })

  const items = React.useMemo(() => {
    const all = yarnsQuery.data?.items ?? []
    const term = query.trim().toLowerCase()
    return all
      .filter((yarn) => {
        if (filter === 'mine') return !yarn.isGlobal
        if (filter === 'global') return yarn.isGlobal
        return true
      })
      .filter((yarn) => {
        if (!term) return true
        return (
          yarn.name.toLowerCase().includes(term) ||
          yarn.material.toLowerCase().includes(term) ||
          String(yarn.count).includes(term)
        )
      })
      .sort((a, b) => {
        if (a.isGlobal !== b.isGlobal) return a.isGlobal ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }, [yarnsQuery.data, filter, query])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['yarns'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const saveMutation = useMutation({
    mutationFn: (payload: {
      name: string
      system: Yarn['system']
      count: number
      material: string
      priceEgp: number
    }) =>
      editing
        ? api<Yarn>(`/yarns/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : api<Yarn>('/yarns', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm)
      toast.success(t('library.yarnSaved'))
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'quota_reached') {
        setFormOpen(false)
        setUpgradeOpen(true)
        return
      }
      setFormError(t('library.yarnError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/yarns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success(t('library.yarnDeleted'))
    },
    onError: () => toast.error(t('common.unexpectedError')),
  })

  const refreshRates = useMutation({
    mutationFn: () => api<{ items: Rate[] }>('/rates/refresh', { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.setQueryData(['rates'], data)
      toast.success(t('library.rates'))
    },
    onError: () => toast.error(t('common.networkError')),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (yarn: Yarn) => {
    setEditing(yarn)
    setForm({
      name: yarn.name,
      system: yarn.system,
      count: String(yarn.count),
      material: yarn.material,
      priceEgp: String(yarn.priceEgp),
    })
    setFormError(null)
    setFormOpen(true)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const count = Number(form.count)
    const price = Number(form.priceEgp)

    if (form.name.trim().length < 1) {
      setFormError(t('library.yarnName'))
      return
    }
    if (!Number.isFinite(count) || count <= 0) {
      setFormError(t('library.countHint'))
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError(t('library.priceHint'))
      return
    }

    saveMutation.mutate({
      name: form.name.trim(),
      system: form.system,
      count,
      material: form.material.trim(),
      priceEgp: price,
    })
  }

  const mineCount = (yarnsQuery.data?.items ?? []).filter((y) => !y.isGlobal).length
  const globalCount = (yarnsQuery.data?.items ?? []).filter((y) => y.isGlobal).length
  const rates = ratesQuery.data?.items ?? []
  const usdRate = rates.find((r) => r.key === 'usd_egp')
  const cottonRate = rates.find((r) => r.key === 'cotton_usd_kg')
  const polyesterRate = rates.find((r) => r.key === 'polyester_usd_kg')

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('library.title')}
        subtitle={t('library.subtitle')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-3.5" />
            {t('library.addYarn')}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-3.5">
          <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
            <Layers className="size-4" />
          </span>
          <div>
            <p className="text-[11px] text-muted">{t('library.allYarns')}</p>
            <p className="mt-0.5 text-[18px] font-semibold leading-none tabular-nums text-ink">
              {formatNumber(yarnsQuery.data?.items.length ?? 0, locale)}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <span className="grid size-9 place-items-center rounded-lg bg-surface-muted text-ink-soft">
            <UserRound className="size-4" />
          </span>
          <div>
            <p className="text-[11px] text-muted">{t('library.myYarns')}</p>
            <p className="mt-0.5 text-[18px] font-semibold leading-none tabular-nums text-ink">
              {formatNumber(mineCount, locale)}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <span className="grid size-9 place-items-center rounded-lg bg-info-soft text-[#175cd3]">
            <Globe2 className="size-4" />
          </span>
          <div>
            <p className="text-[11px] text-muted">{t('library.globalYarns')}</p>
            <p className="mt-0.5 text-[18px] font-semibold leading-none tabular-nums text-ink">
              {formatNumber(globalCount, locale)}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search')}
                className="ps-8"
                aria-label={t('common.search')}
              />
            </div>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('library.allYarns') },
                { value: 'mine', label: t('library.mine') },
                { value: 'global', label: t('library.global') },
              ]}
            />
          </div>

          <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_92px] items-center gap-3 border-b border-line bg-surface-muted px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted md:grid">
            <span>{t('library.yarnName')}</span>
            <span>{t('library.countUnit')}</span>
            <span>{t('library.priceUnit')}</span>
            <span className="text-end">{t('common.actions')}</span>
          </div>

          {yarnsQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Package className="size-4" />}
              title={query ? t('library.noResults') : t('library.empty')}
              description={query ? undefined : t('library.emptyHint')}
              action={
                !query && (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="size-3.5" />
                    {t('library.addYarn')}
                  </Button>
                )
              }
            />
          ) : (
            <ul>
              {items.map((yarn) => (
                <li
                  key={yarn.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface-muted md:grid-cols-[minmax(0,1fr)_110px_110px_92px]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-lg border',
                        yarn.isGlobal
                          ? 'border-line bg-surface-muted text-muted'
                          : 'border-accent/15 bg-accent-soft text-accent',
                      )}
                    >
                      <Layers className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[12.5px] font-medium text-ink">{yarn.name}</p>
                        <Badge tone={yarn.isGlobal ? 'neutral' : 'accent'}>
                          {yarn.isGlobal ? t('library.global') : t('library.mine')}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[10.5px] text-muted">
                        {yarn.material || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <p className="text-[12px] font-medium tabular-nums text-ink">
                      {formatNumber(yarn.count, locale, 2)}
                    </p>
                    <p className="text-[10px] text-muted">{systemLabel(yarn.system)}</p>
                  </div>

                  <div className="hidden md:block">
                    <p className="text-[12px] font-medium tabular-nums text-ink">
                      {formatNumber(yarn.priceEgp, locale, 2)}
                    </p>
                    <p className="text-[10px] text-muted">{t('common.egp')} / kg</p>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    {yarn.isGlobal ? (
                      <Badge tone="neutral" className="hidden md:inline-flex">
                        <Globe2 className="size-2.5" />
                        {t('library.global')}
                      </Badge>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(yarn)}
                          aria-label={t('library.editYarn')}
                          title={t('library.editYarn')}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteTarget(yarn)}
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                        >
                          <Trash2 className="size-3.5 text-accent" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col xl:sticky xl:top-[68px] xl:self-start">
          <CardHeader
            title={t('library.rates')}
            subtitle={t('calc.priceNote')}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshRates.mutate()}
                loading={refreshRates.isPending}
              >
                <RefreshCw className="size-3" />
                {t('library.refreshRates')}
              </Button>
            }
          />
          <div className="space-y-2 p-3">
            {ratesQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : (
              <>
                <RateTile
                  label={t('library.usdEgp')}
                  value={usdRate?.value}
                  unit={t('library.perUsd')}
                  locale={locale}
                  icon={<TrendingUp className="size-3.5" />}
                />
                <RateTile
                  label={t('library.cotton')}
                  value={cottonRate?.value}
                  unit={t('library.perKg')}
                  locale={locale}
                  icon={<Package className="size-3.5" />}
                />
                <RateTile
                  label={t('library.polyester')}
                  value={polyesterRate?.value}
                  unit={t('library.perKg')}
                  locale={locale}
                  icon={<Package className="size-3.5" />}
                />
              </>
            )}

            <p className="pt-1 text-[10.5px] leading-4 text-muted">
              {usdRate
                ? t('library.updated', { time: formatDateTime(usdRate.fetchedAt, locale) })
                : t('common.noData')}
            </p>
          </div>
        </Card>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? t('library.editYarn') : t('library.addYarn')}
        description={t('library.countHint')}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormOpen(false)
                setEditing(null)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button size="sm" loading={saveMutation.isPending} onClick={submit}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <p className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-[12px] text-accent">
              {formError}
            </p>
          )}

          <Field label={t('library.yarnName')} htmlFor="yarn-name">
            <Input
              id="yarn-name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('library.yarnNamePlaceholder')}
              maxLength={80}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('library.system')} htmlFor="yarn-system">
              <Select
                id="yarn-system"
                value={form.system}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, system: e.target.value as Yarn['system'] }))
                }
              >
                <option value="ne">Ne</option>
                <option value="tex">Tex</option>
                <option value="denier">Denier</option>
              </Select>
            </Field>
            <Field label={t('library.count')} htmlFor="yarn-count">
              <Input
                id="yarn-count"
                type="number"
                min={0}
                step="any"
                dir="ltr"
                value={form.count}
                onChange={(e) => setForm((prev) => ({ ...prev, count: e.target.value }))}
                placeholder="20"
              />
            </Field>
          </div>

          <Field label={t('library.material')} htmlFor="yarn-material">
            <Input
              id="yarn-material"
              value={form.material}
              onChange={(e) => setForm((prev) => ({ ...prev, material: e.target.value }))}
              placeholder={t('library.materialPlaceholder')}
              maxLength={80}
            />
          </Field>

          <Field
            label={`${t('library.price')} (${t('common.egp')})`}
            hint={t('library.priceHint')}
            htmlFor="yarn-price"
          >
            <Input
              id="yarn-price"
              type="number"
              min={0}
              step="any"
              dir="ltr"
              value={form.priceEgp}
              onChange={(e) => setForm((prev) => ({ ...prev, priceEgp: e.target.value }))}
              placeholder="120"
            />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('common.confirmDelete')}
        description={deleteTarget?.name}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-muted">{t('library.deleteConfirm')}</p>
      </Dialog>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}

function RateTile({
  label,
  value,
  unit,
  locale,
  icon,
}: {
  label: string
  value?: number
  unit: string
  locale: 'ar' | 'en'
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-[15px] font-semibold leading-none tabular-nums text-ink">
        {value === undefined ? '—' : formatNumber(value, locale, 2)}
        <span className="ms-1 text-[10px] font-normal text-muted">{unit}</span>
      </p>
    </div>
  )
}
