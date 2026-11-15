import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import {
  Calculator,
  Sigma,
  Factory,
  Ruler,
  FlaskConical,
  Loader2,
  Info,
  Printer,
  QrCode,
} from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Tabs,
} from '@/components/ui'
import { UpgradeDialog } from '@/components/UpgradeDialog'
import { api, ApiError } from '@/lib/api'
import { useLocale } from '@/lib/locale'
import { cn, formatNumber } from '@/lib/utils'
import { PRINT_PAGE_CSS, escapeHtml, openPrintDocument } from '@/lib/print'
import { generateWeave, renderThumbnail } from '@/features/studio/weave'
import type {
  ConsumptionResult,
  DensityResult,
  Design,
  DesignSummary,
  ERPResult,
  LoomResult,
  SampleResult,
} from '@/lib/types'

type Tab = 'consumption' | 'density' | 'erp' | 'sample' | 'loom'
type System = 'ne' | 'tex'

function Num({
  label,
  value,
  onChange,
  step = 'any',
  min = 0,
  max,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  step?: string
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          dir="ltr"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className={suffix ? 'pe-12' : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-muted">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
}

function ResultTile({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string
  value: string | number
  unit?: string
  tone?: 'default' | 'accent' | 'success'
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
      <p className="text-[10.5px] text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-[16px] font-semibold leading-none tabular-nums',
          tone === 'accent' ? 'text-accent' : tone === 'success' ? 'text-[#067647]' : 'text-ink',
        )}
      >
        {value}
        {unit && <span className="ms-1 text-[10.5px] font-normal text-muted">{unit}</span>}
      </p>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 text-[12px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  )
}

export default function Calculations() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [tab, setTab] = React.useState<Tab>('consumption')
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)

  const designsQuery = useQuery({
    queryKey: ['designs'],
    queryFn: () => api<{ items: DesignSummary[] }>('/designs'),
  })

  const onPlanError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'plan_required') setUpgradeOpen(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('calc.title')} subtitle={t('calc.subtitle')} />

      <Card className="overflow-hidden">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'consumption', label: t('calc.consumption'), icon: <Calculator className="size-3.5" /> },
            { value: 'density', label: t('calc.density'), icon: <Sigma className="size-3.5" /> },
            { value: 'erp', label: t('calc.erp'), icon: <Factory className="size-3.5" /> },
            { value: 'sample', label: t('calc.sample'), icon: <FlaskConical className="size-3.5" /> },
            { value: 'loom', label: t('calc.loom'), icon: <Ruler className="size-3.5" /> },
          ]}
          className="px-3"
        />
        <div className="p-4">
          {tab === 'consumption' && <ConsumptionTab onPlanError={onPlanError} />}
          {tab === 'density' && (
            <DensityTab designs={designsQuery.data?.items ?? []} onPlanError={onPlanError} />
          )}
          {tab === 'erp' && (
            <ErpTab designs={designsQuery.data?.items ?? []} onPlanError={onPlanError} locale={locale} />
          )}
          {tab === 'sample' && <SampleTab onPlanError={onPlanError} locale={locale} />}
          {tab === 'loom' && (
            <LoomTab designs={designsQuery.data?.items ?? []} onPlanError={onPlanError} locale={locale} />
          )}
        </div>
      </Card>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}

/* --------------------------------------------------------------- shared */

function useDesign(id: string | null) {
  return useQuery({
    queryKey: ['design', id],
    queryFn: () => api<Design>(`/designs/${id}`),
    enabled: !!id,
    retry: false,
  })
}

function DesignPicker({
  designs,
  value,
  onChange,
}: {
  designs: DesignSummary[]
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Field label={t('calc.design')} className="sm:col-span-2">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('calc.noDesign')}</option>
        {designs.map((design) => (
          <option key={design.id} value={design.id}>
            {design.name} — {design.warpEnds}×{design.weftPicks}
          </option>
        ))}
      </Select>
    </Field>
  )
}

function PlanNote() {
  const { t } = useTranslation()
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-line bg-surface-muted px-3 py-2 text-[11px] text-muted">
      <Info className="mt-0.5 size-3 shrink-0" />
      {t('calc.proFeature')}
    </p>
  )
}

/* ---------------------------------------------------------- consumption */

function ConsumptionTab({ onPlanError }: { onPlanError: (err: unknown) => void }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [form, setForm] = React.useState({
    system: 'ne' as System,
    warpCount: 20,
    weftCount: 20,
    warpDensity: 24,
    weftDensity: 20,
    warpCrimp: 5,
    weftCrimp: 8,
    warpPrice: 120,
    weftPrice: 110,
    fabricWidthCm: 150,
    selvedgeEnds: 48,
    weavingCost: 4,
    finishingCost: 2,
    profitMargin: 20,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api<ConsumptionResult>('/calc/consumption', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onError: onPlanError,
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const result = mutation.data
  const money = (value: number) =>
    `${formatNumber(value, locale, 2)} ${t('common.egp')}`

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-3 text-[12.5px] font-medium text-ink">{t('calc.consumptionDesc')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('calc.system')} className="col-span-2">
            <Segmented
              value={form.system}
              onChange={(value) => set('system', value)}
              options={[
                { value: 'ne', label: t('calc.ne') },
                { value: 'tex', label: t('calc.tex') },
              ]}
              size="md"
              className="w-full"
            />
          </Field>
          <Num label={t('calc.warpCount')} value={form.warpCount} onChange={(v) => set('warpCount', v)} />
          <Num label={t('calc.weftCount')} value={form.weftCount} onChange={(v) => set('weftCount', v)} />
          <Num label={t('calc.warpDensity')} value={form.warpDensity} onChange={(v) => set('warpDensity', v)} />
          <Num label={t('calc.weftDensity')} value={form.weftDensity} onChange={(v) => set('weftDensity', v)} />
          <Num label={t('calc.warpCrimp')} value={form.warpCrimp} onChange={(v) => set('warpCrimp', v)} suffix="%" />
          <Num label={t('calc.weftCrimp')} value={form.weftCrimp} onChange={(v) => set('weftCrimp', v)} suffix="%" />
          <Num label={t('calc.warpPrice')} value={form.warpPrice} onChange={(v) => set('warpPrice', v)} suffix={t('common.egp')} />
          <Num label={t('calc.weftPrice')} value={form.weftPrice} onChange={(v) => set('weftPrice', v)} suffix={t('common.egp')} />
          <Num label={t('calc.width')} value={form.fabricWidthCm} onChange={(v) => set('fabricWidthCm', v)} suffix={t('common.cm')} />
          <Num label={t('calc.selvedge')} value={form.selvedgeEnds} onChange={(v) => set('selvedgeEnds', v)} />
          <Num label={t('calc.weavingCost')} value={form.weavingCost} onChange={(v) => set('weavingCost', v)} />
          <Num label={t('calc.finishingCost')} value={form.finishingCost} onChange={(v) => set('finishingCost', v)} />
          <Num label={t('calc.margin')} value={form.profitMargin} onChange={(v) => set('profitMargin', v)} suffix="%" />
        </div>

        <Button className="mt-4 w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          <Calculator className="size-3.5" />
          {mutation.isPending ? t('calc.calculating') : t('calc.calculate')}
        </Button>
        <p className="mt-2 text-[10.5px] text-muted">{t('calc.saveToHistory')}</p>
      </div>

      <div className="rounded-[10px] border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">{t('calc.results')}</p>
          {result && (
            <Badge
              tone={
                result.coverStatus === 'balanced' ? 'success' : result.coverStatus === 'dense' ? 'accent' : 'warning'
              }
            >
              {result.coverStatus === 'balanced'
                ? t('calc.coverBalanced')
                : result.coverStatus === 'dense'
                  ? t('calc.coverDense')
                  : t('calc.coverLight')}
            </Badge>
          )}
        </div>

        {mutation.isPending ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ResultTile label={t('calc.totalEnds')} value={formatNumber(result.totalWarpEnds, locale)} />
              <ResultTile
                label={t('calc.coverFactor')}
                value={`${formatNumber(result.coverPercent, locale)}%`}
                tone={result.coverStatus === 'balanced' ? 'success' : 'accent'}
              />
              <ResultTile
                label={t('calc.totalWeightSqm')}
                value={formatNumber(result.totalWeightSqM, locale, 1)}
                unit="g/m²"
              />
              <ResultTile
                label={t('calc.totalWeightM')}
                value={formatNumber(result.totalWeightLinearM, locale, 1)}
                unit="g/m"
              />
            </div>

            <div>
              <ResultRow label={t('calc.warpWeightSqm')} value={`${formatNumber(result.warpWeightSqM, locale, 1)} g/m²`} />
              <ResultRow label={t('calc.weftWeightSqm')} value={`${formatNumber(result.weftWeightSqM, locale, 1)} g/m²`} />
              <ResultRow label={t('calc.yarnCost')} value={money(result.yarnCost)} />
              <ResultRow label={t('calc.mfgCost')} value={money(result.manufacturingCost)} />
              <ResultRow label={t('calc.profit')} value={money(result.profitValue)} />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2.5">
              <span className="text-[11.5px] font-medium text-accent">{t('calc.sellingPrice')}</span>
              <span className="text-[15px] font-semibold tabular-nums text-accent">
                {money(result.sellingPrice)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
            <Sigma className="size-5 text-muted" />
            <p className="text-[12px] text-muted">{t('calc.enterValues')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- density */

function DensityTab({
  designs,
  onPlanError,
}: {
  designs: DesignSummary[]
  onPlanError: (err: unknown) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [designId, setDesignId] = React.useState('')
  const [form, setForm] = React.useState({ system: 'ne' as System, warpCount: 20, weftCount: 20 })
  const design = useDesign(designId || null)

  const mutation = useMutation({
    mutationFn: () => {
      const d = design.data
      const weave = d
        ? d.weaveData
        : generateWeave(16, 16, { type: 'plain' })
      return api<DensityResult>('/calc/density', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          warpEnds: d?.warpEnds ?? 16,
          weftPicks: d?.weftPicks ?? 16,
          weave,
        }),
      })
    },
    onError: onPlanError,
  })

  const result = mutation.data

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-3 text-[12.5px] font-medium text-ink">{t('calc.densityDesc')}</p>
        <div className="grid grid-cols-2 gap-3">
          <DesignPicker designs={designs} value={designId} onChange={setDesignId} />
          <Field label={t('calc.system')} className="col-span-2">
            <Segmented
              value={form.system}
              onChange={(value) => setForm((prev) => ({ ...prev, system: value }))}
              options={[
                { value: 'ne', label: t('calc.ne') },
                { value: 'tex', label: t('calc.tex') },
              ]}
              size="md"
              className="w-full"
            />
          </Field>
          <Num
            label={t('calc.warpCount')}
            value={form.warpCount}
            onChange={(v) => setForm((prev) => ({ ...prev, warpCount: v }))}
          />
          <Num
            label={t('calc.weftCount')}
            value={form.weftCount}
            onChange={(v) => setForm((prev) => ({ ...prev, weftCount: v }))}
          />
        </div>
        <p className="mt-3 rounded-lg border border-line bg-surface-muted px-3 py-2 text-[11px] text-muted">
          {design.data
            ? t('calc.currentDesign') + `: ${design.data.name}`
            : t('calc.noDesignColors')}
        </p>
        <Button className="mt-4 w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          <Sigma className="size-3.5" />
          {mutation.isPending ? t('calc.calculating') : t('calc.estimateDensity')}
        </Button>
      </div>

      <div className="rounded-[10px] border border-line bg-white p-4">
        <p className="mb-3 text-[13px] font-semibold text-ink">{t('calc.results')}</p>
        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ResultTile label={t('calc.warpDensity')} value={formatNumber(result.warpDensity, locale, 1)} unit="/cm" />
              <ResultTile label={t('calc.weftDensity')} value={formatNumber(result.weftDensity, locale, 1)} unit="/cm" />
              <ResultTile label={t('calc.warpCrimp')} value={formatNumber(result.warpCrimp, locale, 1)} unit="%" />
              <ResultTile label={t('calc.weftCrimp')} value={formatNumber(result.weftCrimp, locale, 1)} unit="%" />
            </div>
            <div>
              <ResultRow label={t('calc.warpNe')} value={formatNumber(result.warpNe, locale, 2)} />
              <ResultRow label={t('calc.weftNe')} value={formatNumber(result.weftNe, locale, 2)} />
              <ResultRow label="Tex" value={`${formatNumber(result.warpTex, locale, 2)} / ${formatNumber(result.weftTex, locale, 2)}`} />
            </div>
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
            <Sigma className="size-5 text-muted" />
            <p className="text-[12px] text-muted">{t('calc.enterValues')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- ERP */

function ErpTab({
  designs,
  onPlanError,
  locale,
}: {
  designs: DesignSummary[]
  onPlanError: (err: unknown) => void
  locale: 'ar' | 'en'
}) {
  const { t } = useTranslation()
  const [designId, setDesignId] = React.useState('')
  const design = useDesign(designId || null)
  const [form, setForm] = React.useState({
    system: 'ne' as System,
    warpCount: 20,
    weftCount: 20,
    warpDensity: 24,
    weftDensity: 20,
    warpCrimp: 5,
    weftCrimp: 8,
    warpPrice: 120,
    weftPrice: 110,
    fabricWidthCm: 150,
    selvedgeEnds: 48,
    weavingCost: 4,
    finishingCost: 2,
    profitMargin: 20,
    orderMeters: 1000,
    wastePercent: 4,
    loomRpm: 450,
    loomEff: 85,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api<ERPResult>('/calc/erp', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          warpColors: design.data?.warpColors ?? [],
          weftColors: design.data?.weftColors ?? [],
        }),
      }),
    onError: onPlanError,
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const result = mutation.data
  const money = (value: number) => `${formatNumber(value, locale)} ${t('common.egp')}`

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-3 text-[12.5px] font-medium text-ink">{t('calc.erpDesc')}</p>
          <div className="grid grid-cols-2 gap-3">
            <DesignPicker designs={designs} value={designId} onChange={setDesignId} />
            <Field label={t('calc.system')} className="col-span-2">
              <Segmented
                value={form.system}
                onChange={(value) => set('system', value)}
                options={[
                  { value: 'ne', label: t('calc.ne') },
                  { value: 'tex', label: t('calc.tex') },
                ]}
                size="md"
                className="w-full"
              />
            </Field>
            <Num label={t('calc.warpCount')} value={form.warpCount} onChange={(v) => set('warpCount', v)} />
            <Num label={t('calc.weftCount')} value={form.weftCount} onChange={(v) => set('weftCount', v)} />
            <Num label={t('calc.warpDensity')} value={form.warpDensity} onChange={(v) => set('warpDensity', v)} />
            <Num label={t('calc.weftDensity')} value={form.weftDensity} onChange={(v) => set('weftDensity', v)} />
            <Num label={t('calc.warpCrimp')} value={form.warpCrimp} onChange={(v) => set('warpCrimp', v)} suffix="%" />
            <Num label={t('calc.weftCrimp')} value={form.weftCrimp} onChange={(v) => set('weftCrimp', v)} suffix="%" />
            <Num label={t('calc.warpPrice')} value={form.warpPrice} onChange={(v) => set('warpPrice', v)} suffix={t('common.egp')} />
            <Num label={t('calc.weftPrice')} value={form.weftPrice} onChange={(v) => set('weftPrice', v)} suffix={t('common.egp')} />
            <Num label={t('calc.width')} value={form.fabricWidthCm} onChange={(v) => set('fabricWidthCm', v)} suffix={t('common.cm')} />
            <Num label={t('calc.selvedge')} value={form.selvedgeEnds} onChange={(v) => set('selvedgeEnds', v)} />
            <Num label={t('calc.orderMeters')} value={form.orderMeters} onChange={(v) => set('orderMeters', v)} suffix={t('common.meters')} />
            <Num label={t('calc.waste')} value={form.wastePercent} onChange={(v) => set('wastePercent', v)} suffix="%" />
            <Num label={t('calc.rpm')} value={form.loomRpm} onChange={(v) => set('loomRpm', v)} />
            <Num label={t('calc.efficiency')} value={form.loomEff} onChange={(v) => set('loomEff', v)} suffix="%" />
            <Num label={t('calc.weavingCost')} value={form.weavingCost} onChange={(v) => set('weavingCost', v)} />
            <Num label={t('calc.finishingCost')} value={form.finishingCost} onChange={(v) => set('finishingCost', v)} />
            <Num label={t('calc.margin')} value={form.profitMargin} onChange={(v) => set('profitMargin', v)} suffix="%" />
          </div>
          <Button className="mt-4 w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            <Factory className="size-3.5" />
            {mutation.isPending ? t('calc.calculating') : t('calc.calculate')}
          </Button>
          <div className="mt-2">
            <PlanNote />
          </div>
        </div>

        <div className="rounded-[10px] border border-line bg-white p-4">
          <p className="mb-3 text-[13px] font-semibold text-ink">{t('calc.results')}</p>
          {result ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <ResultTile label={t('calc.totalWarpKg')} value={formatNumber(result.totalWarpKg, locale, 2)} unit={t('common.kg')} />
                <ResultTile label={t('calc.totalWeftKg')} value={formatNumber(result.totalWeftKg, locale, 2)} unit={t('common.kg')} />
                <ResultTile label={t('calc.totalYarnKg')} value={formatNumber(result.totalYarnKg, locale, 2)} unit={t('common.kg')} />
                <ResultTile
                  label={t('calc.loomTime')}
                  value={t('calc.days', { days: result.days, hours: result.remainingHours })}
                />
              </div>

              <div>
                <ResultRow label={t('calc.metersPerHour')} value={formatNumber(result.metersPerHour, locale, 2)} />
                <ResultRow label={t('calc.totalCost')} value={money(result.grandTotalCost)} />
                <ResultRow label={t('calc.profit')} value={money(result.netProfit)} />
              </div>

              {result.warpBreakdown.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted">{t('calc.warpBreakdown')}</p>
                  <div className="overflow-hidden rounded-lg border border-line">
                    {result.warpBreakdown.map((row) => (
                      <div
                        key={`w-${row.code}-${row.hex}`}
                        className="flex items-center gap-2 border-b border-line px-2.5 py-1.5 text-[11px] last:border-0"
                      >
                        <span className="size-3 rounded-sm border border-black/10" style={{ backgroundColor: row.hex }} />
                        <span className="font-medium text-ink">{row.code}</span>
                        <span className="ms-auto text-muted">{formatNumber(row.percentage, locale, 1)}%</span>
                        <span className="w-14 text-end tabular-nums text-ink">
                          {formatNumber(row.kg, locale, 2)} {t('common.kg')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.weftBreakdown.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-muted">{t('calc.weftBreakdown')}</p>
                  <div className="overflow-hidden rounded-lg border border-line">
                    {result.weftBreakdown.map((row) => (
                      <div
                        key={`f-${row.code}-${row.hex}`}
                        className="flex items-center gap-2 border-b border-line px-2.5 py-1.5 text-[11px] last:border-0"
                      >
                        <span className="size-3 rounded-sm border border-black/10" style={{ backgroundColor: row.hex }} />
                        <span className="font-medium text-ink">{row.code}</span>
                        <span className="ms-auto text-muted">{formatNumber(row.percentage, locale, 1)}%</span>
                        <span className="w-14 text-end tabular-nums text-ink">
                          {formatNumber(row.kg, locale, 2)} {t('common.kg')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2.5">
                <span className="text-[11.5px] font-medium text-accent">{t('calc.finalValue')}</span>
                <span className="text-[15px] font-semibold tabular-nums text-accent">
                  {money(result.finalOrderValue)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
              <Factory className="size-5 text-muted" />
              <p className="text-[12px] text-muted">{t('calc.enterValues')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- sample */

function SampleTab({
  onPlanError,
  locale,
}: {
  onPlanError: (err: unknown) => void
  locale: 'ar' | 'en'
}) {
  const { t } = useTranslation()
  const [form, setForm] = React.useState({
    lengthCm: 10,
    widthCm: 10,
    weightGram: 2.2,
    warpDensity: 28,
    weftDensity: 22,
    crimpPercent: 6,
    knownWarpNe: 0,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api<SampleResult>('/calc/sample', { method: 'POST', body: JSON.stringify(form) }),
    onError: onPlanError,
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const result = mutation.data

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-3 text-[12.5px] font-medium text-ink">{t('calc.sampleDesc')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Num label={t('calc.sampleLength')} value={form.lengthCm} onChange={(v) => set('lengthCm', v)} suffix={t('common.cm')} />
          <Num label={t('calc.sampleWidth')} value={form.widthCm} onChange={(v) => set('widthCm', v)} suffix={t('common.cm')} />
          <Num label={t('calc.sampleWeight')} value={form.weightGram} onChange={(v) => set('weightGram', v)} suffix="g" />
          <Num label={t('calc.crimp')} value={form.crimpPercent} onChange={(v) => set('crimpPercent', v)} suffix="%" />
          <Num label={t('calc.warpDensity')} value={form.warpDensity} onChange={(v) => set('warpDensity', v)} />
          <Num label={t('calc.weftDensity')} value={form.weftDensity} onChange={(v) => set('weftDensity', v)} />
          <Num
            label={t('calc.knownWarpNe')}
            value={form.knownWarpNe}
            onChange={(v) => set('knownWarpNe', v)}
            min={0}
          />
        </div>
        <Button className="mt-4 w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          <FlaskConical className="size-3.5" />
          {mutation.isPending ? t('calc.calculating') : t('calc.calculate')}
        </Button>
        <div className="mt-2">
          <PlanNote />
        </div>
      </div>

      <div className="rounded-[10px] border border-line bg-white p-4">
        <p className="mb-3 text-[13px] font-semibold text-ink">{t('calc.results')}</p>
        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ResultTile label={t('calc.gsm')} value={formatNumber(result.gsm, locale, 1)} unit="g/m²" tone="accent" />
              <ResultTile
                label={t('calc.weightPerMeter')}
                value={formatNumber(result.weightPerMeter150, locale, 1)}
                unit="g/m"
              />
              <ResultTile label={t('calc.warpNe')} value={formatNumber(result.warpNe, locale, 1)} />
              <ResultTile label={t('calc.weftNe')} value={formatNumber(result.weftNe, locale, 1)} />
            </div>
            <div>
              <ResultRow label={`${t('calc.warpNe')} · Tex`} value={formatNumber(result.warpTex, locale, 1)} />
              <ResultRow label={`${t('calc.weftNe')} · Tex`} value={formatNumber(result.weftTex, locale, 1)} />
              <ResultRow label={`${t('calc.warpNe')} · ${t('calc.denierUnit')}`} value={formatNumber(result.warpDenier, locale)} />
              <ResultRow label={`${t('calc.weftNe')} · ${t('calc.denierUnit')}`} value={formatNumber(result.weftDenier, locale)} />
              <ResultRow label={`${t('calc.closest')} · ${t('share.warp')}`} value={result.warpClosest} />
              <ResultRow label={`${t('calc.closest')} · ${t('share.weft')}`} value={result.weftClosest} />
            </div>
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
            <FlaskConical className="size-5 text-muted" />
            <p className="text-[12px] text-muted">{t('calc.enterValues')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ loom */

function LoomTab({
  designs,
  onPlanError,
  locale,
}: {
  designs: DesignSummary[]
  onPlanError: (err: unknown) => void
  locale: 'ar' | 'en'
}) {
  const { t } = useTranslation()
  const [designId, setDesignId] = React.useState('')
  const design = useDesign(designId || null)
  const [cardPending, setCardPending] = React.useState(false)
  const [form, setForm] = React.useState({
    warpDensity: 24,
    endsPerDent: 2,
    fabricWidthCm: 150,
    widthCrimp: 6,
    selvedgeEnds: 48,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api<LoomResult>('/calc/loom', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          warpEnds: design.data?.warpEnds ?? 16,
          weftPicks: design.data?.weftPicks ?? 16,
          weave: design.data?.weaveData ?? generateWeave(16, 16, { type: 'plain' }),
        }),
      }),
    onError: onPlanError,
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const result = mutation.data

  const printLoomCard = async () => {
    if (!designId) {
      toast.error(t('calc.selectDesignFirst'))
      return
    }
    if (!result || !design.data) return
    setCardPending(true)
    try {
      const share = await api<{ url: string }>(`/designs/${designId}/share`, { method: 'POST' })
      const d = design.data
      const image = renderThumbnail(
        {
          warpEnds: d.warpEnds,
          weftPicks: d.weftPicks,
          weaveData: d.weaveData,
          cellColors: d.cellColors,
          warpColors: d.warpColors,
          weftColors: d.weftColors,
        },
        900,
      )
      const qr = await QRCode.toString(share.url, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#14181F', light: '#FFFFFF' },
      })
      const rtl = locale === 'ar'
      const specs: [string, string][] = [
        [t('calc.reedWidth'), `${formatNumber(result.reedWidthCm, locale, 1)} ${t('common.cm')}`],
        [t('calc.metricReed'), formatNumber(result.metricReed, locale, 1)],
        [t('calc.englishReed'), formatNumber(result.englishReed, locale)],
        [t('calc.dents'), formatNumber(result.totalDents, locale)],
        [t('calc.endsPerDent'), formatNumber(form.endsPerDent, locale)],
        [t('calc.groundEnds'), formatNumber(result.totalGroundEnds, locale)],
        [t('calc.selvedge'), formatNumber(result.selvedgeEnds, locale)],
        [t('calc.totalEnds'), formatNumber(result.totalEnds, locale)],
        [t('calc.shafts'), formatNumber(result.shaftCount, locale)],
        [t('studio.warpEnds'), formatNumber(d.warpEnds, locale)],
        [t('studio.weftPicks'), formatNumber(d.weftPicks, locale)],
      ]
      const palette = [...d.warpColors, ...d.weftColors].slice(0, 16)
      const html = `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8">
<title>${escapeHtml(t('calc.cardTitle'))} · ${escapeHtml(d.name)}</title>
<style>${PRINT_PAGE_CSS}
  body { font-family: ${rtl ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif"}; }
  .top { display: flex; gap: 18px; align-items: flex-start; margin-top: 14px; }
  .top img { width: 240px; border: 1px solid #E4E4E1; border-radius: 8px; }
  .top .body { flex: 1; min-width: 0; }
  .tag { display: inline-block; border: 1px solid #14181F; border-radius: 999px; padding: 2px 8px; font-size: 9.5px; font-weight: 600; letter-spacing: .05em; }
</style></head><body>
<div class="head">
  <div>
    <div class="brand">TEXTILE CAD STUDIO</div>
    <h1>${escapeHtml(t('calc.cardTitle'))}</h1>
    <div class="muted">${escapeHtml(d.name)}</div>
    <div style="margin-top:8px"><span class="tag">${formatNumber(d.warpEnds, locale)} × ${formatNumber(d.weftPicks, locale)}</span></div>
  </div>
  <div class="qr">
    ${qr}
    <div class="qr-url">${escapeHtml(share.url)}</div>
    <div style="font-size:9.5px;font-weight:600;margin-top:4px">${escapeHtml(t('calc.cardScan'))}</div>
  </div>
</div>
<div class="top avoid">
  <img src="${image}" alt="">
  <div class="body">
    <h2 style="margin-top:0">${escapeHtml(t('calc.loomCard'))}</h2>
    <table>
      ${specs.map(([k, v]) => `<tr><td class="muted" style="width:52%">${escapeHtml(k)}</td><td style="font-weight:600">${escapeHtml(v)}</td></tr>`).join('')}
    </table>
  </div>
</div>
<h2>${escapeHtml(t('calc.shafts'))}</h2>
<table class="avoid">
  <thead><tr><th>${escapeHtml(t('calc.shafts'))}</th><th>${escapeHtml(t('calc.perRepeatShort', 'In repeat'))}</th><th>${escapeHtml(t('calc.cardHeddles'))}</th></tr></thead>
  <tbody>
    ${result.shafts
      .map(
        (shaft) =>
          `<tr><td>${escapeHtml(t('calc.shaft', { index: shaft.index }))}</td><td>${formatNumber(shaft.inRepeat, locale)}</td><td>${formatNumber(shaft.heddles, locale)}</td></tr>`,
      )
      .join('')}
  </tbody>
</table>
<h2>${escapeHtml(t('print.palette'))}</h2>
<div class="swatches">
  ${palette.map((c) => `<span class="sw" style="background:${escapeHtml(c)}"></span>`).join('')}
</div>
<div class="foot">
  <span>${escapeHtml(t('print.generated'))}</span>
  <span>${escapeHtml(t('print.date'))}: ${new Date().toLocaleDateString(rtl ? 'ar-EG' : 'en-US')}</span>
</div>
</body></html>`
      if (!openPrintDocument(html)) toast.error(t('calc.cardPopupBlocked'))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'plan_required') onPlanError(err)
      else toast.error(t('calc.cardError'))
    } finally {
      setCardPending(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-3 text-[12.5px] font-medium text-ink">{t('calc.loomDesc')}</p>
        <div className="grid grid-cols-2 gap-3">
          <DesignPicker designs={designs} value={designId} onChange={setDesignId} />
          <Num label={t('calc.warpDensity')} value={form.warpDensity} onChange={(v) => set('warpDensity', v)} />
          <Num label={t('calc.endsPerDent')} value={form.endsPerDent} onChange={(v) => set('endsPerDent', v)} step="1" min={1} max={8} />
          <Num label={t('calc.width')} value={form.fabricWidthCm} onChange={(v) => set('fabricWidthCm', v)} suffix={t('common.cm')} />
          <Num label={t('calc.widthCrimp')} value={form.widthCrimp} onChange={(v) => set('widthCrimp', v)} suffix="%" />
          <Num label={t('calc.selvedge')} value={form.selvedgeEnds} onChange={(v) => set('selvedgeEnds', v)} />
        </div>
        <Button className="mt-4 w-full" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          <Ruler className="size-3.5" />
          {mutation.isPending ? t('calc.calculating') : t('calc.calculate')}
        </Button>
        <Button
          className="mt-2 w-full"
          variant="secondary"
          onClick={printLoomCard}
          loading={cardPending}
          disabled={!result}
        >
          <QrCode className="size-3.5" />
          {cardPending ? t('calc.cardGenerating') : t('calc.loomCard')}
        </Button>
        <p className="mt-1.5 text-[11px] leading-4 text-muted">{t('calc.loomCardDesc')}</p>
        <div className="mt-2">
          <PlanNote />
        </div>
      </div>

      <div className="rounded-[10px] border border-line bg-white p-4">
        <p className="mb-3 text-[13px] font-semibold text-ink">{t('calc.results')}</p>
        {result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <ResultTile label={t('calc.reedWidth')} value={formatNumber(result.reedWidthCm, locale, 1)} unit={t('common.cm')} />
              <ResultTile label={t('calc.metricReed')} value={formatNumber(result.metricReed, locale, 1)} />
              <ResultTile label={t('calc.englishReed')} value={formatNumber(result.englishReed, locale)} />
              <ResultTile label={t('calc.dents')} value={formatNumber(result.totalDents, locale)} />
            </div>
            <ResultRow label={t('calc.groundEnds')} value={formatNumber(result.totalGroundEnds, locale)} />
            <ResultRow label={t('calc.selvedge')} value={formatNumber(result.selvedgeEnds, locale)} />
            <ResultRow label={t('calc.totalEnds')} value={formatNumber(result.totalEnds, locale)} />
            <ResultRow label={t('calc.shafts')} value={formatNumber(result.shaftCount, locale)} />

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted">{t('calc.shafts')}</p>
              <div className="overflow-hidden rounded-lg border border-line">
                {result.shafts.map((shaft) => (
                  <div
                    key={shaft.index}
                    className="flex items-center justify-between border-b border-line px-2.5 py-1.5 text-[11px] last:border-0"
                  >
                    <span className="font-medium text-ink">
                      {t('calc.shaft', { index: shaft.index })}
                    </span>
                    <span className="text-muted">
                      {t('calc.perRepeat', { count: shaft.inRepeat })} · {t('calc.heddles', { count: shaft.heddles })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={printLoomCard}
              loading={cardPending}
            >
              <Printer className="size-3.5" />
              {t('calc.printLoomCard', 'Print Technical Loom Card')}
            </Button>
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
            <Ruler className="size-5 text-muted" />
            <p className="text-[12px] text-muted">{t('calc.enterValues')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
