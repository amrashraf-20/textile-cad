import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Cpu, CheckCircle2, Sliders, ShieldAlert } from 'lucide-react'
import { analyzeLoomFeasibility, type LoomAnalysis } from './loomDrafting'
import { cn } from '@/lib/utils'

interface LoomDraftingPanelProps {
  weaveData: number[][]
  warpEnds: number
  weftPicks: number
  isDoubleMode?: boolean
  faceRatio?: number
  backRatio?: number
  warpColors?: string[]
  weftColors?: string[]
}

export function LoomDraftingPanel({
  weaveData,
  warpEnds,
  weftPicks,
  isDoubleMode = false,
  faceRatio = 1,
  backRatio = 1,
}: LoomDraftingPanelProps) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language.startsWith('ar')

  const analysis: LoomAnalysis = React.useMemo(() => {
    return analyzeLoomFeasibility(weaveData, warpEnds, weftPicks, {
      isDoubleMode,
      faceRatio,
      backRatio,
    })
  }, [weaveData, warpEnds, weftPicks, isDoubleMode, faceRatio, backRatio])

  const { numShafts, isJacquardRequired, draftAssignments, pegPlan, floatingWarp, floatingWeft, longFloatWarp, longFloatWeft, reed } = analysis

  const hasFlaws = floatingWarp.length > 0 || floatingWeft.length > 0 || longFloatWarp.length > 0 || longFloatWeft.length > 0

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-4 shadow-xs">
      {/* Header with KPI chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-surface-muted text-ink">
            <Cpu className="size-4 text-accent" />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-ink">
              {t('studio.loomDraftingTitle', 'Industrial Loom Drafting & Mechanism')}
            </h4>
            <p className="text-[11px] text-muted">
              {t('studio.loomDraftingDesc', 'Automated shaft reduction, peg plan, dobby feasibility & float analysis')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-muted px-2.5 py-1 font-medium text-ink">
            <Sliders className="size-3 text-muted" />
            <span>{t('studio.minimumShafts', 'Minimum Shafts')}:</span>
            <strong className="text-ink font-bold">{numShafts}</strong>
          </span>

          {isJacquardRequired ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 font-semibold text-red-700">
              <ShieldAlert className="size-3.5" />
              {t('studio.jacquardRequired', 'Jacquard Loom Required (>24 shafts)')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
              <CheckCircle2 className="size-3.5" />
              {t('studio.dobbyCompatible', 'Dobby Loom Compatible (≤24 shafts)')}
            </span>
          )}

          {!hasFlaws ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
              <CheckCircle2 className="size-3.5" />
              {t('studio.noFloatFlaws', 'Structure Structurally Sound')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
              <AlertTriangle className="size-3.5" />
              {t('studio.flawsDetected', 'Float Warnings Detected')}
            </span>
          )}
        </div>
      </div>

      {/* Jacquard Alert Banner if > 24 shafts */}
      {isJacquardRequired && (
        <div className="rounded-lg border border-red-300 bg-red-50/80 p-3 text-[12px] leading-5 text-red-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
            <div>
              <strong className="font-semibold">
                {ar
                  ? `🚨 تنبيه هندسي: عدد الدرأ المطلوب (${numShafts}) يتجاوز قدرة ماكينة الدوبي القياسية (24 درأة)!`
                  : `🚨 Engineering Alert: Required shaft count (${numShafts}) exceeds standard Dobby loom capacity (24 shafts)!`}
              </strong>
              <p className="mt-0.5 text-red-700">
                {ar
                  ? 'هذا التصميم معقد نسجياً ويجب تشغيله في صالة الإنتاج على نول جاكار إلكتروني (Electronic Jacquard).'
                  : 'This complex structure requires an Electronic Jacquard loom for factory weaving production.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Float Flaw Alerts */}
      {hasFlaws && (
        <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-[11.5px] leading-5 text-amber-900">
          <div className="flex items-center gap-1.5 font-semibold text-amber-950">
            <AlertTriangle className="size-3.5 text-amber-700" />
            <span>{ar ? 'تنبيهات عيوب التطفيل (Float Flaws):' : 'Weave Float Flaws & Warnings:'}</span>
          </div>
          <ul className="list-inside list-disc space-y-0.5 ps-1 text-amber-800">
            {floatingWarp.length > 0 && (
              <li>
                {ar
                  ? `خيوط سداء طافية كلياً بدون تشابك: فتلة رقم [${floatingWarp.slice(0, 8).join(', ')}${floatingWarp.length > 8 ? '…' : ''}]`
                  : `Completely unbound floating warp ends: [${floatingWarp.slice(0, 8).join(', ')}${floatingWarp.length > 8 ? '…' : ''}]`}
              </li>
            )}
            {floatingWeft.length > 0 && (
              <li>
                {ar
                  ? `لحمات طافية كلياً بدون تشابك: حدفة رقم [${floatingWeft.slice(0, 8).join(', ')}${floatingWeft.length > 8 ? '…' : ''}]`
                  : `Completely unbound floating weft picks: [${floatingWeft.slice(0, 8).join(', ')}${floatingWeft.length > 8 ? '…' : ''}]`}
              </li>
            )}
            {longFloatWarp.length > 0 && (
              <li>
                {ar
                  ? `تشريبة سداء طويلة (> 6 حدفات): خيوط [${longFloatWarp.slice(0, 5).map((f) => `#${f.end} (${f.run} حدفة)`).join(', ')}]`
                  : `Long warp floats (> 6 picks): ends [${longFloatWarp.slice(0, 5).map((f) => `#${f.end} (${f.run} picks)`).join(', ')}]`}
              </li>
            )}
            {longFloatWeft.length > 0 && (
              <li>
                {ar
                  ? `تشريبة لحمة طويلة (> 6 فتل): حدفات [${longFloatWeft.slice(0, 5).map((f) => `#${f.pick} (${f.run} فتلة)`).join(', ')}]`
                  : `Long weft floats (> 6 ends): picks [${longFloatWeft.slice(0, 5).map((f) => `#${f.pick} (${f.run} ends)`).join(', ')}]`}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Dual Drafting Grids: Draft Plan + Peg Plan side by side */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
        {/* Draft Plan (Shaft assignments) */}
        <div className="space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-semibold text-ink">
              {ar ? 'مخطط اللقى / التسنين (Draft Plan)' : 'Draft Plan (Heddle Shaft Threading)'}
            </span>
            <span className="text-[10.5px] text-muted">
              {warpEnds} {ar ? 'خيط سداء' : 'warp ends'} → {numShafts} {ar ? 'درأة' : 'shafts'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-surface-muted/40 p-2">
            <div className="inline-block min-w-full">
              {/* Shaft rows from top (Shaft numShafts - 1) down to 0 */}
              <div className="space-y-0.5">
                {Array.from({ length: numShafts }, (_, sRev) => {
                  const s = numShafts - 1 - sRev
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <span className="w-9 shrink-0 text-end text-[10px] font-mono font-medium text-muted">
                        D{s + 1}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: warpEnds }, (_, c) => {
                          const isActive = draftAssignments[c] === s
                          return (
                            <div
                              key={c}
                              className={cn(
                                'size-5 rounded-xs border transition-colors',
                                isActive
                                  ? 'border-accent bg-accent text-white shadow-xs'
                                  : 'border-line/70 bg-white/80',
                              )}
                              title={
                                ar
                                  ? `خيط سداء ${c + 1} على درأة ${s + 1}`
                                  : `Warp end ${c + 1} on shaft ${s + 1}`
                              }
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Warp End Numbers Header */}
              <div className="mt-1 flex items-center gap-1">
                <span className="w-9 shrink-0 text-end text-[9px] text-muted">End</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: warpEnds }, (_, c) => (
                    <div
                      key={c}
                      className="size-5 text-center text-[9px] font-mono text-muted/80 leading-5"
                    >
                      {c + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Peg Plan / Lifting Plan */}
        <div className="space-y-1.5 overflow-hidden">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-semibold text-ink">
              {ar ? 'مخطط الرباط / الرفع (Peg Plan)' : 'Peg Plan (Lifting Table)'}
            </span>
            <span className="text-[10.5px] text-muted">
              {weftPicks} {ar ? 'حدفة' : 'picks'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-line bg-surface-muted/40 p-2">
            <div className="inline-block min-w-full">
              {/* Pick rows from top (weftPicks - 1) down to 0 */}
              <div className="space-y-0.5">
                {Array.from({ length: weftPicks }, (_, rRev) => {
                  const r = weftPicks - 1 - rRev
                  return (
                    <div key={r} className="flex items-center gap-1">
                      <span className="w-8 shrink-0 text-end text-[10px] font-mono font-medium text-muted">
                        P{r + 1}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: numShafts }, (_, s) => {
                          const isActive = pegPlan[r]?.[s] === 1
                          return (
                            <div
                              key={s}
                              className={cn(
                                'size-5 rounded-xs border transition-colors',
                                isActive
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                  : 'border-line/70 bg-white/80',
                              )}
                              title={
                                ar
                                  ? `حدفة ${r + 1}: رفع درأة ${s + 1}`
                                  : `Pick ${r + 1}: Lift shaft ${s + 1}`
                              }
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Shaft Numbers Footer */}
              <div className="mt-1 flex items-center gap-1">
                <span className="w-8 shrink-0 text-end text-[9px] text-muted">Shaft</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: numShafts }, (_, s) => (
                    <div
                      key={s}
                      className="size-5 text-center text-[9px] font-mono text-muted/80 leading-5"
                    >
                      D{s + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reed Setup Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted/60 px-3 py-2 text-[11px] text-muted">
        <div className="flex items-center gap-3">
          <span>
            {ar ? 'نمرة المشط (Reed Count):' : 'Reed Count:'}{' '}
            <strong className="text-ink font-semibold">{reed.reedCount}</strong> dents/cm
          </span>
          <span>·</span>
          <span>
            {ar ? 'التمرير بالباب (Ends/Dent):' : 'Ends/Dent:'}{' '}
            <strong className="text-ink font-semibold">{reed.endsPerDent}</strong> ends
          </span>
          <span>·</span>
          <span>
            {ar ? 'عرض القماش المقدر:' : 'Estimated Fabric Width:'}{' '}
            <strong className="text-ink font-semibold">{reed.fabricWidthCm}</strong> cm
          </span>
        </div>
        <div className="text-[10.5px] italic text-muted">
          {ar ? 'حسابات مطابقة لمعايير معامل النسيج الصناعية' : 'Calculations compliant with ISO/ASTM textile standards'}
        </div>
      </div>
    </div>
  )
}
