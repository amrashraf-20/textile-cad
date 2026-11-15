import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Sparkles, Shuffle, Layers, Grid3x3, RefreshCw } from 'lucide-react'

import { Button, Dialog, Field, Input, Segmented, Select, Switch } from '@/components/ui'
import {
  COLORWAYS,
  STRUCTURES,
  STRUCTURE_FAMILIES,
  defaultOptions,
  generateCompoundWeave,
  generateStructure,
  renderStructurePreview,
  type StructureDef,
  type StructureOptions,
  type WeaveDraft,
} from './weave'
import { applyColorAndWeaveEffect, generateGenerativeWeave, type ColorAndWeaveEffect, type GenerativeStyle } from './weave'

export interface ApplyWeavePayload {
  weaveData: number[][]
  warpColors?: string[]
  weftColors?: string[]
  draft?: WeaveDraft
  structureId?: string
}

interface AutoWeaveDialogProps {
  open: boolean
  onClose: () => void
  warpEnds: number
  weftPicks: number
  onApply: (data: ApplyWeavePayload) => void
}

type TabType = 'library' | 'generative' | 'effects' | 'compose'
type ColorMode = 'keep' | 'colourway' | 'contrast'

export function AutoWeaveDialog({ open, onClose, warpEnds, weftPicks, onApply }: AutoWeaveDialogProps) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language.startsWith('ar')

  const [tab, setTab] = React.useState<TabType>('library')
  const [family, setFamily] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')
  const [selectedId, setSelectedId] = React.useState('twill')
  const [options, setOptions] = React.useState<StructureOptions>({})
  const [colorMode, setColorMode] = React.useState<ColorMode>('keep')
  const [colorwayId, setColorwayId] = React.useState('indigo')

  const [generativeStyle, setGenerativeStyle] = React.useState<GenerativeStyle>('symmetric')
  const [effect, setEffect] = React.useState<ColorAndWeaveEffect>('houndstooth')
  const [color1, setColor1] = React.useState('#F5F2E9')
  const [color2, setColor2] = React.useState('#16202D')

  const [faceRatio, setFaceRatio] = React.useState(1)
  const [stitching, setStitching] = React.useState(true)
  const [layers, setLayers] = React.useState(2)

  const selected = React.useMemo(
    () => STRUCTURES.find((s) => s.id === selectedId) ?? STRUCTURES[0],
    [selectedId],
  )

  // Reset params when the selected structure changes.
  React.useEffect(() => {
    setOptions(defaultOptions(selected))
  }, [selected])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return STRUCTURES.filter((s) => {
      if (family !== 'all' && s.family !== family) return false
      if (!q) return true
      return `${s.nameEn} ${s.nameAr} ${s.descEn} ${s.descAr}`.toLowerCase().includes(q)
    })
  }, [family, search])

  const previews = React.useMemo(() => {
    if (!open) return {} as Record<string, string>
    const out: Record<string, string> = {}
    for (const s of STRUCTURES) {
      out[s.id] = renderStructurePreview(s.id, defaultOptions(s), 112)
    }
    return out
  }, [open])

  const selectedPreview = React.useMemo(() => {
    if (!open) return ''
    return renderStructurePreview(selectedId, options, 260)
  }, [open, selectedId, options])

  const colorsFor = (): { warpColors?: string[]; weftColors?: string[] } => {
    if (colorMode === 'keep') return {}
    if (colorMode === 'contrast') {
      return {
        warpColors: Array(warpEnds).fill('#243447'),
        weftColors: Array(weftPicks).fill('#F2ECDD'),
      }
    }
    const cw = COLORWAYS.find((c) => c.id === colorwayId) ?? COLORWAYS[0]
    return {
      warpColors: Array(warpEnds).fill(cw.warp),
      weftColors: Array(weftPicks).fill(cw.weft),
    }
  }

  const applyLibrary = () => {
    const res = generateStructure(selectedId, warpEnds, weftPicks, options)
    onApply({
      weaveData: res.weave,
      draft: res.draft,
      structureId: selectedId,
      ...colorsFor(),
    })
    onClose()
  }

  const applyGenerative = () => {
    const res = generateGenerativeWeave(warpEnds, weftPicks, generativeStyle)
    onApply({ weaveData: res.weave, warpColors: res.warpColors, weftColors: res.weftColors })
    onClose()
  }

  const applyEffect = () => {
    const res = applyColorAndWeaveEffect(warpEnds, weftPicks, effect, color1, color2)
    onApply({ weaveData: res.weave, warpColors: res.warpColors, weftColors: res.weftColors })
    onClose()
  }

  const applyCompound = () => {
    const res = generateCompoundWeave(warpEnds, weftPicks, layers, {
      faceRatio,
      stitching: stitching ? 1 : 0,
    })
    onApply({
      weaveData: res.weave,
      ...colorsFor(),
    })
    onClose()
  }

  const renderParam = (p: StructureDef['params'][number]) => {
    const value = options[p.key] ?? p.default
    if (p.type === 'select' && p.options) {
      return (
        <Field key={p.key} label={ar ? p.labelAr : p.labelEn}>
          <Select
            value={String(value)}
            onChange={(e) => setOptions((prev) => ({ ...prev, [p.key]: e.target.value }))}
          >
            {p.options.map((o) => (
              <option key={o.value} value={o.value}>
                {ar ? o.labelAr : o.labelEn}
              </option>
            ))}
          </Select>
        </Field>
      )
    }
    return (
      <Field key={p.key} label={ar ? p.labelAr : p.labelEn}>
        <Input
          type="number"
          min={p.min}
          max={p.max}
          step={p.step ?? 1}
          value={Number(value)}
          onChange={(e) => setOptions((prev) => ({ ...prev, [p.key]: Number(e.target.value) }))}
          dir="ltr"
        />
      </Field>
    )
  }

  const colorControls = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('studio.colorMode', 'Colours')}>
        <Select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)}>
          <option value="keep">{t('studio.colorKeep', 'Keep current yarn colours')}</option>
          <option value="colourway">{t('studio.colorColourway', 'Apply a dye-house colourway')}</option>
          <option value="contrast">{t('studio.colorContrast', 'Draft contrast (dark / ecru)')}</option>
        </Select>
      </Field>
      {colorMode === 'colourway' && (
        <Field label={t('studio.colourway', 'Colourway')}>
          <Select value={colorwayId} onChange={(e) => setColorwayId(e.target.value)}>
            {COLORWAYS.map((c) => (
              <option key={c.id} value={c.id}>
                {ar ? c.nameAr : c.nameEn}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('studio.autoWeaveTitle', 'Weave structure library')}
      description={t(
        'studio.autoWeaveDesc',
        'Industrial drafts: threading, tie-up and treadling for every classic structure.',
      )}
      width="max-w-5xl"
    >
      <div className="space-y-4 pt-1">
        <Segmented<TabType>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'library', label: t('studio.tabLibrary', 'Structure library') },
            { value: 'generative', label: t('studio.tabGenerative', 'Generative') },
            { value: 'effects', label: t('studio.tabEffects', 'Colour & weave') },
            { value: 'compose', label: t('studio.tabCompose', 'Compound cloth') },
          ]}
        />

        {tab === 'library' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('studio.searchStructure', 'Search structures…')}
                    className="ps-8"
                  />
                </div>
                <Select
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  className="w-auto"
                >
                  <option value="all">{t('studio.allFamilies', 'All families')}</option>
                  {STRUCTURE_FAMILIES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {ar ? f.nameAr : f.nameEn}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-auto pe-1 sm:grid-cols-3 xl:grid-cols-4">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`group rounded-lg border p-2 text-start transition ${
                      selectedId === s.id
                        ? 'border-accent bg-accent/5 shadow-xs'
                        : 'border-line bg-white hover:border-line-strong'
                    }`}
                  >
                    <div className="mb-1.5 overflow-hidden rounded-md border border-line bg-white">
                      {previews[s.id] ? (
                        <img
                          src={previews[s.id]}
                          alt={ar ? s.nameAr : s.nameEn}
                          className="block aspect-square w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="aspect-square w-full bg-surface-muted" />
                      )}
                    </div>
                    <p className="truncate text-[11.5px] font-semibold text-ink">
                      {ar ? s.nameAr : s.nameEn}
                    </p>
                    <p className="truncate text-[10px] text-muted">
                      {STRUCTURE_FAMILIES.find((f) => f.id === s.family)?.[ar ? 'nameAr' : 'nameEn']}
                    </p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-full py-6 text-center text-[12px] text-muted">
                    {t('studio.noStructures', 'No structure matches this filter.')}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-line bg-surface-muted/50 p-3">
              <div className="overflow-hidden rounded-lg border border-line bg-white">
                {selectedPreview && (
                  <img
                    src={selectedPreview}
                    alt={ar ? selected.nameAr : selected.nameEn}
                    className="block aspect-square w-full object-cover"
                  />
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">
                  {ar ? selected.nameAr : selected.nameEn}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-muted">
                  {ar ? selected.descAr : selected.descEn}
                </p>
              </div>

              {selected.params.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selected.params.map((p) => renderParam(p))}
                </div>
              )}

              {colorControls}

              <Button className="w-full" size="md" onClick={applyLibrary}>
                <Grid3x3 className="size-3.5" />
                {t('studio.applyStructure', 'Apply structure')}
              </Button>
            </div>
          </div>
        )}

        {tab === 'generative' && (
          <div className="space-y-4 rounded-xl border border-line bg-surface-muted/50 p-4">
            <p className="text-[12.5px] leading-5 text-ink-soft">
              {t(
                'studio.generativeHint',
                'Generate balanced, repeatable colour-and-weave patterns from a seed. Every result is a real repeat, not noise.',
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  { id: 'symmetric', en: 'Symmetry', ar: 'تناظر' },
                  { id: 'diamond', en: 'Diamond', ar: 'معينات' },
                  { id: 'tartan', en: 'Tartan', ar: 'تارتان' },
                  { id: 'optical', en: 'Optical wave', ar: 'خداع بصري' },
                  { id: 'modern', en: 'Modern hybrid', ar: 'هجين عصري' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGenerativeStyle(item.id)}
                  className={`rounded-lg border p-3 text-start text-[12px] font-medium transition ${
                    generativeStyle === item.id
                      ? 'border-accent bg-accent/10 font-semibold text-accent shadow-xs'
                      : 'border-line bg-white text-ink hover:border-line-strong'
                  }`}
                >
                  {ar ? item.ar : item.en}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" size="md" onClick={applyGenerative}>
                <Shuffle className="size-3.5" />
                {t('studio.generateNow', 'Generate & apply')}
              </Button>
            </div>
          </div>
        )}

        {tab === 'effects' && (
          <div className="space-y-4 rounded-xl border border-line bg-surface-muted/50 p-4">
            <Field label={t('studio.effectType', 'Colour & weave effect')}>
              <Select value={effect} onChange={(e) => setEffect(e.target.value as ColorAndWeaveEffect)}>
                <option value="houndstooth">{t('studio.effectHoundstooth', 'Houndstooth (2/2 twill)')}</option>
                <option value="hairline">{t('studio.effectHairline', 'Hairline (1/1 plain)')}</option>
                <option value="step">{t('studio.effectStep', 'Step effect (1/1 plain)')}</option>
                <option value="glenPlaid">{t('studio.effectGlenPlaid', 'Glen plaid / Prince of Wales')}</option>
                <option value="pincheck">{t('studio.effectPincheck', 'Pin check')}</option>
                <option value="birdseye">{t('studio.effectBirdseye', 'Birdseye diamond')}</option>
                <option value="algorithmic">{t('studio.effectAlgorithmic', 'Algorithmic waves')}</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('studio.colorOne', 'Light colour')}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color1}
                    onChange={(e) => setColor1(e.target.value)}
                    className="size-8 cursor-pointer rounded-md border border-line p-0.5"
                  />
                  <Input value={color1} onChange={(e) => setColor1(e.target.value)} dir="ltr" />
                </div>
              </Field>
              <Field label={t('studio.colorTwo', 'Dark colour')}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color2}
                    onChange={(e) => setColor2(e.target.value)}
                    className="size-8 cursor-pointer rounded-md border border-line p-0.5"
                  />
                  <Input value={color2} onChange={(e) => setColor2(e.target.value)} dir="ltr" />
                </div>
              </Field>
            </div>
            <Button className="w-full" size="md" onClick={applyEffect}>
              <Sparkles className="size-3.5" />
              {t('studio.applyEffect', 'Apply effect')}
            </Button>
          </div>
        )}

        {tab === 'compose' && (
          <div className="space-y-4 rounded-xl border border-line bg-surface-muted/50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('studio.layers', 'Layers')}>
                <Select value={String(layers)} onChange={(e) => setLayers(Number(e.target.value))}>
                  <option value="2">{t('studio.doubleCloth', 'Double cloth')}</option>
                  <option value="3">{t('studio.tripleCloth', 'Triple cloth')}</option>
                </Select>
              </Field>
              <Field label={t('studio.faceRatio', 'Face / back ratio')}>
                <Select value={String(faceRatio)} onChange={(e) => setFaceRatio(Number(e.target.value))}>
                  <option value="1">1 : 1</option>
                  <option value="2">2 : 1</option>
                  <option value="3">3 : 1</option>
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2">
              <span className="text-[12px] font-medium text-ink">
                {t('studio.stitchingPoints', 'Automatic stitching points')}
              </span>
              <Switch checked={stitching} onChange={setStitching} />
            </div>
            {colorControls}
            <Button className="w-full" size="md" onClick={applyCompound}>
              <Layers className="size-3.5" />
              {t('studio.generateDoubleCloth', 'Generate compound cloth')}
            </Button>
            <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted">
              <RefreshCw className="mt-0.5 size-3 shrink-0" />
              {t(
                'studio.compoundHint',
                'Face and back interchange in blocks; stitching picks bind the layers so the cloth cannot delaminate.',
              )}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
