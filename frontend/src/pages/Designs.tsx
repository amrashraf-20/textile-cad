import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  Copy,
  Trash2,
  Share2,
  FolderOpen,
  ArrowUpRight,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
} from '@/components/ui'
import { WeaveThumb } from '@/components/WeaveThumb'
import { UpgradeDialog } from '@/components/UpgradeDialog'
import { useLocale } from '@/lib/locale'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { cn, formatDate } from '@/lib/utils'
import { generateWeave } from '@/features/studio/weave'
import type { Design, DesignSummary } from '@/lib/types'

type SortKey = 'recent' | 'name' | 'size'

export default function Designs() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)
  const [params, setParams] = useSearchParams()

  const [view, setView] = React.useState<'grid' | 'list'>('grid')
  const [sort, setSort] = React.useState<SortKey>('recent')
  const [query, setQuery] = React.useState(params.get('q') ?? '')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<DesignSummary | null>(null)
  const [shareTarget, setShareTarget] = React.useState<DesignSummary | null>(null)
  const [shareUrl, setShareUrl] = React.useState('')
  const [menuId, setMenuId] = React.useState<string | null>(null)

  const isPro = user?.plan === 'pro' || user?.role === 'admin'

  const designsQuery = useQuery({
    queryKey: ['designs'],
    queryFn: () => api<{ items: DesignSummary[] }>('/designs'),
  })

  React.useEffect(() => {
    setQuery(params.get('q') ?? '')
  }, [params])

  const items = React.useMemo(() => {
    const all = designsQuery.data?.items ?? []
    const term = query.trim().toLowerCase()
    const filtered = term ? all.filter((d) => d.name.toLowerCase().includes(term)) : all
    const sorted = [...filtered]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'size') sorted.sort((a, b) => b.warpEnds * b.weftPicks - a.warpEnds * a.weftPicks)
    else sorted.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    return sorted
  }, [designsQuery.data, query, sort])

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; warpEnds: number; weftPicks: number }) =>
      api<Design>('/designs', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (design) => {
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(t('studio.designSaved'))
      navigate(`/${locale}/app/studio/${design.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.code === 'plan_required' || err.code === 'quota_reached')) {
        setCreateOpen(false)
        setUpgradeOpen(true)
        return
      }
      toast.error(t('studio.designError'))
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api<Design>(`/designs/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      toast.success(t('studio.designDuplicated'))
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'quota_reached') setUpgradeOpen(true)
      else toast.error(t('studio.designError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/designs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setDeleteTarget(null)
      toast.success(t('studio.designDeleted'))
    },
    onError: () => toast.error(t('common.unexpectedError')),
  })

  const shareMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ url: string; expiresAt: string }>(`/designs/${id}/share`, { method: 'POST' }),
    onSuccess: (data) => {
      setShareUrl(data.url)
      toast.success(t('studio.shareCreated'))
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'plan_required') {
        setShareTarget(null)
        setUpgradeOpen(true)
      } else toast.error(t('studio.shareError'))
    },
  })

  const onSearch = (value: string) => {
    setQuery(value)
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.designs')}
        subtitle={t('dashboard.recentSub')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            {t('dashboard.newDesign')}
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('common.search')}
            className="ps-8"
            aria-label={t('common.search')}
          />
        </div>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="w-auto min-w-[130px]"
          aria-label={t('common.all')}
        >
          <option value="recent">{t('dashboard.updated')}</option>
          <option value="name">{t('common.name')}</option>
          <option value="size">{t('studio.size')}</option>
        </Select>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'grid', label: <LayoutGrid className="size-3.5" /> },
            { value: 'list', label: <List className="size-3.5" /> },
          ]}
        />
        <Badge tone="neutral">
          {items.length} {t('dashboard.kpiDesigns')}
        </Badge>
      </Card>

      {designsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[186px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderOpen className="size-4" />}
            title={query ? t('library.noResults') : t('dashboard.noDesigns')}
            description={query ? undefined : t('dashboard.noDesignsHint')}
            action={
              !query && (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="size-3.5" />
                  {t('dashboard.createFirst')}
                </Button>
              )
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((design) => (
            <Card key={design.id} className="group relative overflow-hidden">
              <Link to={`/${locale}/app/studio/${design.id}`} className="block">
                <div className="relative grid h-[112px] place-items-center border-b border-line bg-surface-muted">
                  {design.thumbnail ? (
                    <img
                      src={design.thumbnail}
                      alt={design.name}
                      className="max-h-[92px] max-w-[80%] rounded-[6px] border border-line object-contain shadow-[0_2px_8px_rgba(16,24,40,.06)]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="weave-grid-bg grid size-[84px] place-items-center rounded-[6px] border border-line bg-white text-muted">
                      <FolderOpen className="size-5" />
                    </div>
                  )}
                  <span className="absolute end-2 top-2 rounded-full border border-line bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    v{design.version}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate text-[12.5px] font-medium text-ink group-hover:text-accent">
                    {design.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span>
                      {design.warpEnds} × {design.weftPicks}
                    </span>
                    <span className="text-line-strong">·</span>
                    <span>{formatDate(design.updatedAt, locale)}</span>
                  </p>
                </div>
              </Link>
              <div className="absolute end-1.5 top-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setMenuId(menuId === design.id ? null : design.id)
                  }}
                  className="grid size-7 place-items-center rounded-md bg-white/95 text-muted opacity-0 shadow-sm transition-opacity hover:text-ink group-hover:opacity-100"
                  aria-label={t('common.actions')}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
                {menuId === design.id && (
                  <div className="absolute end-0 top-8 z-10 w-40 overflow-hidden rounded-lg border border-line bg-white p-1 shadow-[0_10px_28px_rgba(16,24,40,.14)] animate-fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null)
                        navigate(`/${locale}/app/studio/${design.id}`)
                      }}
                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                    >
                      <ArrowUpRight className="size-3.5" />
                      {t('common.open')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null)
                        duplicateMutation.mutate(design.id)
                      }}
                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                    >
                      <Copy className="size-3.5" />
                      {t('common.duplicate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null)
                        if (!isPro) setUpgradeOpen(true)
                        else {
                          setShareTarget(design)
                          setShareUrl('')
                          shareMutation.mutate(design.id)
                        }
                      }}
                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                    >
                      <Share2 className="size-3.5" />
                      {t('common.share')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null)
                        setDeleteTarget(design)
                      }}
                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-accent hover:bg-accent-soft"
                    >
                      <Trash2 className="size-3.5" />
                      {t('common.delete')}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_120px_140px_100px] items-center gap-3 border-b border-line bg-surface-muted px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted md:grid">
            <span>{t('common.name')}</span>
            <span>{t('studio.size')}</span>
            <span>{t('dashboard.updated')}</span>
            <span className="text-end">{t('common.actions')}</span>
          </div>
          {items.map((design) => (
            <div
              key={design.id}
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface-muted md:grid-cols-[1fr_120px_140px_100px]"
            >
              <Link to={`/${locale}/app/studio/${design.id}`} className="flex min-w-0 items-center gap-2.5">
                <div className="size-8 shrink-0 overflow-hidden rounded-[6px] border border-line bg-white">
                  {design.thumbnail ? (
                    <img src={design.thumbnail} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="weave-grid-bg size-full" />
                  )}
                </div>
                <span className="truncate text-[12.5px] font-medium text-ink hover:text-accent">
                  {design.name}
                </span>
              </Link>
              <span className="hidden text-[11.5px] text-muted md:block">
                {design.warpEnds} × {design.weftPicks}
              </span>
              <span className="hidden text-[11.5px] text-muted md:block">
                {formatDate(design.updatedAt, locale)}
              </span>
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => duplicateMutation.mutate(design.id)}
                  aria-label={t('common.duplicate')}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeleteTarget(design)}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="size-3.5 text-accent" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <NewDesignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxGrid={isPro ? 100 : 16}
        pending={createMutation.isPending}
        onCreate={(payload) => createMutation.mutate(payload)}
        onUpgrade={() => {
          setCreateOpen(false)
          setUpgradeOpen(true)
        }}
      />

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
        <p className="text-[12.5px] text-muted">{t('common.deleteWarning')}</p>
      </Dialog>

      <Dialog
        open={!!shareTarget}
        onClose={() => {
          setShareTarget(null)
          setShareUrl('')
        }}
        title={t('studio.shareDesign')}
        description={t('studio.shareHint')}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShareTarget(null)
                setShareUrl('')
              }}
            >
              {t('common.close')}
            </Button>
            {shareUrl && (
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl)
                  toast.success(t('common.copied'))
                }}
              >
                {t('common.copy')}
              </Button>
            )}
          </>
        }
      >
        {shareMutation.isPending ? (
          <Skeleton className="h-9" />
        ) : (
          <Input readOnly value={shareUrl} dir="ltr" onFocus={(e) => e.target.select()} />
        )}
      </Dialog>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}

const PRESETS = [8, 16, 32, 48, 64, 100]

function NewDesignDialog({
  open,
  onClose,
  maxGrid,
  pending,
  onCreate,
  onUpgrade,
}: {
  open: boolean
  onClose: () => void
  maxGrid: number
  pending: boolean
  onCreate: (payload: { name: string; warpEnds: number; weftPicks: number }) => void
  onUpgrade: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = React.useState('')
  const [warp, setWarp] = React.useState(16)
  const [weft, setWeft] = React.useState(16)

  React.useEffect(() => {
    if (open) {
      setName('')
      setWarp(Math.min(16, maxGrid))
      setWeft(Math.min(16, maxGrid))
    }
  }, [open, maxGrid])

  const clampValue = (value: number) => Math.max(2, Math.min(maxGrid, value || 2))
  const presetLocked = maxGrid < 32

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const w = clampValue(warp)
    const h = clampValue(weft)
    onCreate({
      name: name.trim() || t('studio.untitled'),
      warpEnds: w,
      weftPicks: h,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.newDesignTitle')}
      description={t('studio.freeLimitNote')}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={pending} onClick={submit}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('studio.designName')} htmlFor="design-name">
          <Input
            id="design-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('studio.untitled')}
            maxLength={120}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('studio.warpEnds')} htmlFor="warp">
            <Input
              id="warp"
              type="number"
              min={2}
              max={maxGrid}
              value={warp}
              onChange={(e) => setWarp(clampValue(Number(e.target.value)))}
              dir="ltr"
            />
          </Field>
          <Field label={t('studio.weftPicks')} htmlFor="weft">
            <Input
              id="weft"
              type="number"
              min={2}
              max={maxGrid}
              value={weft}
              onChange={(e) => setWeft(clampValue(Number(e.target.value)))}
              dir="ltr"
            />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[12px] font-medium text-ink-soft">{t('studio.size')}</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              const locked = preset > maxGrid
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    if (locked) onUpgrade()
                    else {
                      setWarp(preset)
                      setWeft(preset)
                    }
                  }}
                  className={cn(
                    'h-7 rounded-md border px-2 text-[11.5px] transition-colors',
                    warp === preset && weft === preset
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-white text-ink-soft hover:border-line-strong',
                    locked && 'opacity-45',
                  )}
                >
                  {preset}×{preset}
                  {locked && ' · PRO'}
                </button>
              )
            })}
          </div>
          {presetLocked && (
            <p className="mt-2 text-[11px] text-muted">{t('studio.freeLimitNote')}</p>
          )}
        </div>

        <div className="grid place-items-center rounded-lg border border-line bg-surface-muted py-4">
          <WeaveThumb
            warpEnds={clampValue(warp)}
            weftPicks={clampValue(weft)}
            weaveData={generateWeave(clampValue(warp), clampValue(weft), { type: 'plain' })}
            warpColors={Array.from({ length: clampValue(warp) }, () => '#23364C')}
            weftColors={Array.from({ length: clampValue(weft) }, () => '#F4F1EA')}
            size={96}
          />
        </div>
      </form>
    </Dialog>
  )
}
