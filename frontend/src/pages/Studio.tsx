import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Pencil,
  Eraser,
  Minus,
  Square,
  PaintBucket,
  Pipette,
  Palette,
  Undo2,
  Redo2,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Share2,
  Printer,
  Trash2,
  Copy,
  ChevronDown,
  Grid3x3,
  Layers,
  Repeat2,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Wand2,
  Eye,
  Armchair,
  Upload,
  Scissors,
  LayoutGrid,
  Camera,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Tabs,
  ColorSwatch,
} from '@/components/ui'
import { UpgradeDialog } from '@/components/UpgradeDialog'
import { WeaveCanvas, type Guides, type Tool } from '@/features/studio/WeaveCanvas'
import { useEditor, createDoc, type EditorDoc } from '@/features/studio/useEditor'
import {
  applyStripePattern,
  buildColorway,
  colorway as colorwayById,
  createColorMatrix,
  drawWeave,
  generateStructure,
  repeatMatrix,
  renderThumbnail,
  type WeaveType,
  type WeaveDraft,
} from '@/features/studio/weave'
import type { AssistantAction } from '@/features/studio/assistant'
import { AutoWeaveDialog } from '@/features/studio/AutoWeaveDialog'
import { DraftPlanModal } from '@/features/studio/DraftPlanModal'
import { AssistantPanel } from '@/features/studio/AssistantPanel'
import { SimulationModal } from '@/features/studio/SimulationModal'
import { MockupModal } from '@/features/studio/MockupModal'
import { JacquardModal } from '@/features/studio/JacquardModal'
import { CrossSectionModal } from '@/features/studio/CrossSectionModal'
import { LoomDraftingPanel } from '@/features/studio/LoomDraftingPanel'
import { ThreadColorModal, type ThreadTarget } from '@/features/studio/ThreadColorModal'
import { SampleAnalyzerModal } from '@/features/studio/SampleAnalyzerModal'
import { api, ApiError, downloadWithAuth } from '@/lib/api'
import { useLocale } from '@/lib/locale'
import { PRINT_PAGE_CSS, escapeHtml, openPrintDocument } from '@/lib/print'
import { useAuth } from '@/store/auth'
import { clamp, cn, downloadBlob, formatDateTime } from '@/lib/utils'
import type { Design } from '@/lib/types'

type InspectorTab = 'grid' | 'weave' | 'color' | 'repeat'

const tools: { id: Tool; icon: React.ReactNode; key: string; shortcut: string }[] = [
  { id: 'pencil', icon: <Pencil className="size-4" />, key: 'studio.pencil', shortcut: 'P' },
  { id: 'eraser', icon: <Eraser className="size-4" />, key: 'studio.eraser', shortcut: 'E' },
  { id: 'line', icon: <Minus className="size-4 -rotate-45" />, key: 'studio.line', shortcut: 'L' },
  { id: 'rect', icon: <Square className="size-4" />, key: 'studio.rect', shortcut: 'R' },
  { id: 'fill', icon: <PaintBucket className="size-4" />, key: 'studio.fill', shortcut: 'F' },
  { id: 'eyedropper', icon: <Pipette className="size-4" />, key: 'studio.eyedropper', shortcut: 'I' },
  { id: 'color', icon: <Palette className="size-4" />, key: 'studio.color', shortcut: 'C' },
]

function toDoc(design: Design): EditorDoc {
  return {
    name: design.name,
    description: design.description ?? '',
    warpEnds: design.warpEnds,
    weftPicks: design.weftPicks,
    weaveData: design.weaveData ?? [],
    cellColors: design.cellColors ?? [],
    warpColors: design.warpColors ?? [],
    weftColors: design.weftColors ?? [],
    settings: design.settings ?? {},
  }
}

export default function Studio() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuth((s) => s.user)
  const isPro = user?.plan === 'pro' || user?.role === 'admin'

  const [tool, setTool] = React.useState<Tool>('pencil')
  const [tab, setTab] = React.useState<InspectorTab>('grid')
  const [zoom, setZoom] = React.useState(1)
  const [paintColor, setPaintColor] = React.useState('#D92D20')
  const [guides, setGuides] = React.useState<Guides>({
    show: true,
    every: 8,
    color: 'rgba(217,45,32,0.35)',
    thickness: 1,
  })
  const [sizeWarp, setSizeWarp] = React.useState(16)
  const [sizeWeft, setSizeWeft] = React.useState(16)
  const [savedAt, setSavedAt] = React.useState<Date | null>(null)
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [shareOpen, setShareOpen] = React.useState(false)
  const [shareUrl, setShareUrl] = React.useState('')
  const [exportOpen, setExportOpen] = React.useState(false)
  const [weaveType, setWeaveType] = React.useState<WeaveType>('twill')
  const [pattern, setPattern] = React.useState('2/2')
  const [direction, setDirection] = React.useState<'Z' | 'S'>('Z')
  const [repeatSize, setRepeatSize] = React.useState(5)
  const [unitW, setUnitW] = React.useState(4)
  const [unitH, setUnitH] = React.useState(4)
  const [stripeTarget, setStripeTarget] = React.useState<'warp' | 'weft'>('warp')
  const [stripePattern, setStripePattern] = React.useState('4,2,2')
  const [stripeColors, setStripeColors] = React.useState<string[]>(['#23364C', '#D92D20', '#E4E4E1'])

  const [autoWeaveOpen, setAutoWeaveOpen] = React.useState(false)
  const [draftOpen, setDraftOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<WeaveDraft | null>(null)
  const [simulationOpen, setSimulationOpen] = React.useState(false)
  const [mockupOpen, setMockupOpen] = React.useState(false)
  const [jacquardOpen, setJacquardOpen] = React.useState(false)
  const [crossSectionOpen, setCrossSectionOpen] = React.useState(false)
  const [sampleScannerOpen, setSampleScannerOpen] = React.useState(false)
  const [threadModalTarget, setThreadModalTarget] = React.useState<ThreadTarget | null>(null)
  const [threadModalOpen, setThreadModalOpen] = React.useState(false)

  const editor = useEditor(createDoc(16, 16, t('studio.untitled')))
  const { doc } = editor

  const canvasWrapRef = React.useRef<HTMLDivElement | null>(null)
  const loadedId = React.useRef<string | null>(null)

  const designQuery = useQuery({
    queryKey: ['design', id],
    queryFn: () => api<Design>(`/designs/${id}`),
    enabled: !!id,
    retry: false,
  })

  // While a saved design is loading the editor still holds its blank default,
  // so the header must not present that placeholder as the real design.
  const loadingDesign = !!id && designQuery.isLoading

  React.useEffect(() => {
    if (!designQuery.data) return
    if (loadedId.current === designQuery.data.id) return
    loadedId.current = designQuery.data.id
    const next = toDoc(designQuery.data)
    editor.load(next)
    setSizeWarp(next.warpEnds)
    setSizeWeft(next.weftPicks)
    setDraft((designQuery.data.settings?.draft as WeaveDraft | undefined) ?? null)
    setSavedAt(new Date(designQuery.data.updatedAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designQuery.data])

  // A stale link or a design the user no longer owns must not leave a blank
  // editor that silently writes to a missing record.
  React.useEffect(() => {
    if (!id || !designQuery.isError) return
    toast.error(t('studio.designNotFound'))
    navigate(`/${locale}/app/designs`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, designQuery.isError])

  React.useEffect(() => {
    if (id) return
    setSizeWarp(doc.warpEnds)
    setSizeWeft(doc.weftPicks)
  }, [id, doc.warpEnds, doc.weftPicks])

  const payload = React.useCallback(() => {
    const settings = { ...doc.settings, guides, draft: draft ?? undefined }
    return {
      name: doc.name.trim() || t('studio.untitled'),
      description: doc.description,
      warpEnds: doc.warpEnds,
      weftPicks: doc.weftPicks,
      weaveData: doc.weaveData,
      cellColors: doc.cellColors,
      warpColors: doc.warpColors,
      weftColors: doc.weftColors,
      settings,
      thumbnail: renderThumbnail({
        warpEnds: doc.warpEnds,
        weftPicks: doc.weftPicks,
        weaveData: doc.weaveData,
        cellColors: doc.cellColors,
        warpColors: doc.warpColors,
        weftColors: doc.weftColors,
      }),
    }
  }, [doc, guides, draft, t])

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = JSON.stringify(payload())
      return id
        ? api<Design>(`/designs/${id}`, { method: 'PUT', body })
        : api<Design>('/designs', { method: 'POST', body })
    },
    onSuccess: (design) => {
      editor.markSaved()
      setSavedAt(new Date())
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['design', design.id] })
      toast.success(t('studio.designSaved'))
      if (!id) {
        loadedId.current = design.id
        navigate(`/${locale}/app/studio/${design.id}`, { replace: true })
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.code === 'plan_required' || err.code === 'quota_reached')) {
        setUpgradeOpen(true)
        return
      }
      toast.error(t('studio.designError'))
    },
  })

  // Debounced autosave for designs that already exist on the server.
  React.useEffect(() => {
    if (!id || !editor.dirty || saveMutation.isPending) return
    const timer = window.setTimeout(() => saveMutation.mutate(), 1600)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, editor.dirty, id])

  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editor.dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [editor.dirty])

  const deleteMutation = useMutation({
    mutationFn: () => api<void>(`/designs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(t('studio.designDeleted'))
      navigate(`/${locale}/app/designs`, { replace: true })
    },
    onError: () => toast.error(t('common.unexpectedError')),
  })

  const duplicateMutation = useMutation({
    mutationFn: () => api<Design>(`/designs/${id}/duplicate`, { method: 'POST' }),
    onSuccess: (design) => {
      void queryClient.invalidateQueries({ queryKey: ['designs'] })
      toast.success(t('studio.designDuplicated'))
      navigate(`/${locale}/app/studio/${design.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'quota_reached') setUpgradeOpen(true)
      else toast.error(t('studio.designError'))
    },
  })

  const shareMutation = useMutation({
    mutationFn: () => api<{ url: string }>(`/designs/${id}/share`, { method: 'POST' }),
    onSuccess: (data) => {
      setShareUrl(data.url)
      setShareOpen(true)
      toast.success(t('studio.shareCreated'))
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'plan_required') setUpgradeOpen(true)
      else toast.error(t('studio.shareError'))
    },
  })

  /* ------------------------------------------------------------ shortcuts */

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const meta = event.ctrlKey || event.metaKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        editor.redo()
        return
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveMutation.mutate()
        return
      }
      const map: Record<string, Tool> = {
        p: 'pencil',
        e: 'eraser',
        l: 'line',
        r: 'rect',
        f: 'fill',
        i: 'eyedropper',
        c: 'color',
      }
      const next = map[event.key.toLowerCase()]
      if (next && !meta) setTool(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, saveMutation.isPending])

  /* -------------------------------------------------------------- actions */

  const applySize = () => {
    const limit = isPro ? 100 : 16
    const w = clamp(Math.round(sizeWarp) || 2, 2, limit)
    const h = clamp(Math.round(sizeWeft) || 2, 2, limit)
    if (sizeWarp > limit || sizeWeft > limit) setUpgradeOpen(true)
    editor.resize(w, h)
    setSizeWarp(w)
    setSizeWeft(h)
    toast.success(t('studio.gridUpdated'))
  }

  const openThreadPicker = (kind: 'warp' | 'weft', index: number) => {
    const currentColor =
      kind === 'warp' ? (doc.warpColors[index] ?? '#1F3A5F') : (doc.weftColors[index] ?? '#F5F2E9')
    setThreadModalTarget({ kind, index, currentColor })
    setThreadModalOpen(true)
  }

  const handleApplySingleThreadColor = (kind: 'warp' | 'weft', index: number, color: string) => {
    editor.update((current) => {
      if (kind === 'warp') {
        const warpColors = [...current.warpColors]
        warpColors[index] = color
        return { ...current, warpColors }
      }
      const weftColors = [...current.weftColors]
      weftColors[index] = color
      return { ...current, weftColors }
    })
    toast.success(t('studio.colorUpdated', 'Yarn colour updated'))
  }

  const handleApplyAllThreadColor = (kind: 'warp' | 'weft', color: string) => {
    editor.update((current) => {
      if (kind === 'warp') {
        return { ...current, warpColors: current.warpColors.map(() => color) }
      }
      return { ...current, weftColors: current.weftColors.map(() => color) }
    })
    toast.success(t('studio.allColorsUpdated', 'All yarn colours updated'))
  }

  const applyStripes = () => {
    editor.update((current) => {
      if (stripeTarget === 'warp') {
        return { ...current, warpColors: applyStripePattern(current.warpColors, stripePattern, stripeColors) }
      }
      return { ...current, weftColors: applyStripePattern(current.weftColors, stripePattern, stripeColors) }
    })
    toast.success(t('studio.stripeApplied'))
  }

  const applyColorway = () => {
    const seed = Math.floor(Math.random() * 360)
    editor.update((current) => ({
      ...current,
      warpColors: buildColorway(seed, current.warpEnds, true),
      weftColors: buildColorway(seed + 180, current.weftPicks, false),
    }))
    toast.success(t('studio.colorwayApplied'))
  }

  const applyRepeat = () => {
    editor.update((current) => {
      const result = repeatMatrix(current.weaveData, current.cellColors, unitW, unitH)
      return { ...current, weaveData: result.weave, cellColors: result.cellColors }
    })
  }

  const applyWeavePayload = ({
    weaveData,
    warpColors,
    weftColors,
    draft: nextDraft,
  }: {
    weaveData: number[][]
    warpColors?: string[]
    weftColors?: string[]
    draft?: WeaveDraft
  }) => {
    editor.update((current) => ({
      ...current,
      weaveData,
      cellColors: createColorMatrix(current.warpEnds, current.weftPicks),
      warpColors: warpColors ?? current.warpColors,
      weftColors: weftColors ?? current.weftColors,
    }))
    if (nextDraft) setDraft(nextDraft)
  }

  /** Executes assistant commands against the live editor (validated already). */
  const runAssistantActions = (actions: AssistantAction[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'applyStructure': {
          const res = generateStructure(action.id, doc.warpEnds, doc.weftPicks, action.options ?? {})
          applyWeavePayload({ weaveData: res.weave, draft: res.draft })
          break
        }
        case 'colorway': {
          const cw = colorwayById(action.id)
          editor.update((current) => ({
            ...current,
            warpColors: current.warpColors.map(() => cw.warp),
            weftColors: current.weftColors.map(() => cw.weft),
          }))
          break
        }
        case 'setColors': {
          editor.update((current) => ({
            ...current,
            warpColors: action.warp ? current.warpColors.map(() => action.warp!) : current.warpColors,
            weftColors: action.weft ? current.weftColors.map(() => action.weft!) : current.weftColors,
          }))
          break
        }
        case 'resize': {
          const limit = isPro ? 100 : 16
          const w = clamp(action.warpEnds, 2, limit)
          const h = clamp(action.weftPicks, 2, limit)
          editor.resize(w, h)
          setSizeWarp(w)
          setSizeWeft(h)
          break
        }
        case 'clear':
          editor.update((current) => ({
            ...current,
            weaveData: current.weaveData.map((row) => row.map(() => 0)),
            cellColors: current.cellColors.map((row) => row.map(() => null)),
          }))
          break
        case 'openDraft':
          setDraftOpen(true)
          break
        case 'navigate':
          navigate(`/${locale}/app/${action.to}`)
          break
        default:
          break
      }
    }
  }

  const fitZoom = () => {
    const width = canvasWrapRef.current?.clientWidth ?? 0
    if (!width) return
    const available = width - 56
    const next = clamp(available / (doc.warpEnds * 20), 0.3, 3)
    setZoom(Number(next.toFixed(2)))
  }

  const exportPng = () => {
    const cell = 24
    const canvas = document.createElement('canvas')
    canvas.width = doc.warpEnds * cell
    canvas.height = doc.weftPicks * cell
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawWeave(ctx, {
      warpEnds: doc.warpEnds,
      weftPicks: doc.weftPicks,
      weaveData: doc.weaveData,
      cellColors: doc.cellColors,
      warpColors: doc.warpColors,
      weftColors: doc.weftColors,
    }, { cell, gap: 1, background: '#FFFFFF' })
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${doc.name || 'design'}.png`)
    }, 'image/png')
    setExportOpen(false)
  }

  const exportFile = async (kind: 'wif' | 'csv') => {
    if (!id) {
      toast.error(t('studio.designError'))
      return
    }
    try {
      await downloadWithAuth(`/designs/${id}/export/${kind}`, `${doc.name || 'design'}.${kind}`)
      setExportOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'plan_required') setUpgradeOpen(true)
      else toast.error(t('common.unexpectedError'))
    }
  }

  const buildSheet = (kind: 'spec' | 'presentation') => {
    const rtl = locale === 'ar'
    const image = renderThumbnail(
      {
        warpEnds: doc.warpEnds,
        weftPicks: doc.weftPicks,
        weaveData: doc.weaveData,
        cellColors: doc.cellColors,
        warpColors: doc.warpColors,
        weftColors: doc.weftColors,
      },
      kind === 'spec' ? 1200 : 1600,
    )
    const date = new Date().toLocaleDateString(rtl ? 'ar-EG' : 'en-US')
    const palette = [...new Set([...doc.warpColors, ...doc.weftColors])]
    const repeat = draft ? `${draft.repeatW} × ${draft.repeatH}` : `${doc.warpEnds} × ${doc.weftPicks}`
    const construction = draft
      ? draft.mode === 'liftplan'
        ? t('studio.pegPlan')
        : t('studio.tieUpPlan')
      : t('studio.weave')
    const specs: [string, string][] = [
      [t('studio.warpEnds'), String(doc.warpEnds)],
      [t('studio.weftPicks'), String(doc.weftPicks)],
      [t('print.repeat'), repeat],
      [t('print.construction'), construction],
      [t('print.shaftsTreadles'), draft ? `${draft.shafts} / ${draft.treadles}` : '—'],
      [t('studio.grid'), String(doc.warpEnds * doc.weftPicks)],
    ]
    const swatches = palette
      .map(
        (c) =>
          `<div class="swatch"><span class="sw" style="background:${escapeHtml(c)}"></span><span class="hex">${escapeHtml(c.toUpperCase())}</span></div>`,
      )
      .join('')

    if (kind === 'presentation') {
      return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8">
<title>${escapeHtml(doc.name)} · Textile CAD Studio</title>
<style>${PRINT_PAGE_CSS}
  body { font-family: ${rtl ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif"}; }
  .hero { width: 100%; height: 300px; object-fit: cover; border-radius: 10px; border: 1px solid #E4E4E1; margin-top: 16px; }
  .title { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-top: 18px; }
  .title h1 { font-size: 26px; margin: 0; }
  .title .ref { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #6B7280; }
  .desc { margin: 8px 0 0; color: #4B5563; max-width: 78ch; }
  .pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
  .pill { border: 1px solid #D7D7D3; border-radius: 999px; padding: 5px 12px; font-size: 11px; }
  .pill b { font-weight: 600; }
  .swatches { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
  .swatch { display: flex; align-items: center; gap: 6px; font-size: 9.5px; color: #6B7280; }
  .sw { width: 30px; height: 30px; border-radius: 6px; border: 1px solid rgba(0,0,0,.12); display: inline-block; }
  .foot { margin-top: 26px; }
</style></head><body>
<div class="head">
  <div>
    <div class="brand">TEXTILE CAD STUDIO</div>
    <div class="muted" style="margin-top:4px">${escapeHtml(t('studio.presentationSheet'))}</div>
  </div>
  <div class="muted">${escapeHtml(date)}</div>
</div>
<img class="hero" src="${image}" alt="">
<div class="title">
  <h1>${escapeHtml(doc.name)}</h1>
  <div class="ref">${escapeHtml(t('print.version'))} ${doc.warpEnds} × ${doc.weftPicks}</div>
</div>
${doc.description ? `<p class="desc">${escapeHtml(doc.description)}</p>` : ''}
<div class="pills">
  ${specs
    .slice(0, 5)
    .map(([k, v]) => `<span class="pill">${escapeHtml(k)}: <b>${escapeHtml(v)}</b></span>`)
    .join('')}
</div>
<h2>${escapeHtml(t('print.palette'))}</h2>
<div class="swatches">${swatches}</div>
<div class="foot">
  <div class="foot-inner" style="display:flex;justify-content:space-between;font-size:9.5px;color:#9CA3AF;border-top:1px solid #E4E4E1;padding-top:8px">
    <span>${escapeHtml(t('print.generated'))}</span>
    <span>${escapeHtml(t('print.date'))}: ${escapeHtml(date)}</span>
  </div>
</div>
</body></html>`
    }

    return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8">
<title>${escapeHtml(t('studio.specSheet'))} · ${escapeHtml(doc.name)}</title>
<style>${PRINT_PAGE_CSS}
  body { font-family: ${rtl ? "'Cairo','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif"}; }
  .top { display: flex; gap: 20px; align-items: flex-start; margin-top: 16px; }
  .top img { width: 240px; border: 1px solid #E4E4E1; border-radius: 8px; }
  .top .body { flex: 1; min-width: 0; }
  td:first-child { width: 55%; }
  .swatch { display: inline-flex; align-items: center; gap: 5px; margin: 0 10px 6px 0; font-size: 9px; color: #6B7280; }
  .sw { width: 24px; height: 24px; border-radius: 4px; border: 1px solid rgba(0,0,0,.12); display: inline-block; }
  .hex { font-family: ui-monospace, monospace; }
</style></head><body>
<div class="head">
  <div>
    <div class="brand">TEXTILE CAD STUDIO</div>
    <h1>${escapeHtml(t('studio.specSheet'))}</h1>
    <div class="muted">${escapeHtml(doc.name)}</div>
  </div>
  <div class="muted" style="text-align:end">
    <div>${escapeHtml(t('print.date'))}: ${escapeHtml(date)}</div>
    <div>${escapeHtml(t('print.version'))}: v1.0</div>
  </div>
</div>
<div class="top avoid">
  <img src="${image}" alt="">
  <div class="body">
    <h2 style="margin-top:0">${escapeHtml(t('studio.warpEnds'))} / ${escapeHtml(t('studio.weftPicks'))}</h2>
    <table>
      ${specs.map(([k, v]) => `<tr><td class="muted">${escapeHtml(k)}</td><td style="font-weight:600">${escapeHtml(v)}</td></tr>`).join('')}
    </table>
    <h2>${escapeHtml(t('print.palette'))}</h2>
    <div>${swatches}</div>
  </div>
</div>
<div class="foot">
  <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#9CA3AF;border-top:1px solid #E4E4E1;padding-top:8px">
    <span>${escapeHtml(t('print.generated'))}</span>
    <span>Textile CAD Studio · ${escapeHtml(date)}</span>
  </div>
</div>
</body></html>`
  }

  const printSheet = () => {
    if (!openPrintDocument(buildSheet('spec'))) toast.error(t('studio.presentationBlocked'))
    setExportOpen(false)
  }

  const printPresentation = () => {
    if (!openPrintDocument(buildSheet('presentation'))) toast.error(t('studio.presentationBlocked'))
    setExportOpen(false)
  }

  const requestShare = () => {
    if (!isPro) {
      setUpgradeOpen(true)
      return
    }
    if (!id) {
      toast.error(t('studio.designError'))
      return
    }
    shareMutation.mutate()
  }

  /* ----------------------------------------------------------------- view */

  if (designQuery.isError && id) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <AlertCircle className="mx-auto size-6 text-accent" />
        <p className="mt-2 text-[14px] font-medium text-ink">{t('errors.loadFailed')}</p>
        <Link to={`/${locale}/app/designs`} className="mt-4 inline-block">
          <Button size="sm" variant="secondary">
            {t('common.back')}
          </Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Link
            to={`/${locale}/app/designs`}
            className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition-colors hover:text-ink"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Link>
          <div className="min-w-0">
            {loadingDesign ? (
              <>
                <Skeleton className="h-6 w-52" />
                <div className="mt-1 flex items-center gap-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </>
            ) : (
              <>
                <input
                  value={doc.name}
                  onChange={(e) => editor.update((current) => ({ ...current, name: e.target.value }))}
                  placeholder={t('studio.untitled')}
                  className="w-full max-w-[420px] truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[18px] font-semibold tracking-[-0.01em] text-ink hover:border-line focus:border-accent/50 focus:bg-white focus:outline-none"
                  maxLength={120}
                  aria-label={t('studio.designName')}
                />
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted">
                  <Badge tone="neutral">
                    {doc.warpEnds} × {doc.weftPicks}
                  </Badge>
                  {id && <Badge tone="neutral">v{designQuery.data?.version ?? 1}</Badge>}
                  {editor.dirty ? (
                    <span className="flex items-center gap-1 text-warning">
                      <span className="size-1.5 rounded-full bg-warning" />
                      {t('studio.unsaved')}
                    </span>
                  ) : savedAt ? (
                    <span className="flex items-center gap-1 text-success">
                      <Check className="size-3" />
                      {t('studio.savedAt', { time: formatDateTime(savedAt, locale) })}
                    </span>
                  ) : (
                    <span>{t('studio.unsaved')}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-0.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={editor.undo}
              disabled={!editor.canUndo}
              aria-label={t('studio.undo')}
              title={t('studio.undo')}
            >
              <Undo2 className="size-4 rtl:-scale-x-100" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={editor.redo}
              disabled={!editor.canRedo}
              aria-label={t('studio.redo')}
              title={t('studio.redo')}
            >
              <Redo2 className="size-4 rtl:-scale-x-100" />
            </Button>
          </div>

          {/* Advanced Studio Tools */}
          <Button
            variant="secondary"
            size="md"
            onClick={() => setAutoWeaveOpen(true)}
            className="border-accent/40 bg-accent/5 font-semibold text-accent hover:bg-accent/10"
          >
            <Wand2 className="size-3.5" />
            {t('studio.autoWeave')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setSampleScannerOpen(true)}
            className="border-indigo-300/70 bg-indigo-50/60 font-semibold text-indigo-700 hover:bg-indigo-100/60"
          >
            <Camera className="size-3.5" />
            {t('studio.sampleScanner', 'AI Sample Scanner')}
          </Button>

          <Button variant="secondary" size="md" onClick={() => setDraftOpen(true)}>
            <LayoutGrid className="size-3.5" />
            {t('studio.draftPlan', 'Draft plan')}
          </Button>

          <Button variant="secondary" size="md" onClick={() => setSimulationOpen(true)}>
            <Eye className="size-3.5" />
            {t('studio.simulation')}
          </Button>

          <Button variant="secondary" size="md" onClick={() => setMockupOpen(true)}>
            <Armchair className="size-3.5" />
            {t('studio.mockups')}
          </Button>

          <Button variant="secondary" size="md" onClick={() => setJacquardOpen(true)}>
            <Upload className="size-3.5" />
            {t('studio.jacquard')}
          </Button>

          <Button variant="secondary" size="md" onClick={() => setCrossSectionOpen(true)}>
            <Scissors className="size-3.5" />
            {t('studio.crossSection')}
          </Button>

          <div className="relative">
            <Button variant="secondary" size="md" onClick={() => setExportOpen((v) => !v)}>
              <Download className="size-3.5" />
              {t('common.export')}
              <ChevronDown className="size-3" />
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute end-0 top-10 z-20 w-48 overflow-hidden rounded-lg border border-line bg-white p-1 shadow-[0_10px_28px_rgba(16,24,40,.14)] animate-fade-in">
                  <button
                    type="button"
                    onClick={exportPng}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                  >
                    <Download className="size-3.5" /> PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportFile('wif')}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                  >
                    <Download className="size-3.5" /> WIF
                    {!isPro && <span className="ms-auto text-[9.5px] text-accent">PRO</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportFile('csv')}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                  >
                    <Download className="size-3.5" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={printSheet}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                  >
                    <Printer className="size-3.5" /> {t('studio.specSheet')}
                  </button>
                  <button
                    type="button"
                    onClick={printPresentation}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12px] text-ink-soft hover:bg-surface-muted"
                  >
                    <Printer className="size-3.5" /> {t('studio.presentationSheet')}
                  </button>
                </div>
              </>
            )}
          </div>

          <Button variant="secondary" size="md" onClick={requestShare} loading={shareMutation.isPending}>
            <Share2 className="size-3.5" />
            {t('common.share')}
          </Button>

          <Button size="md" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            <Save className="size-3.5" />
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>

          {id && (
            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-0.5">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => duplicateMutation.mutate()}
                disabled={duplicateMutation.isPending}
                aria-label={t('studio.duplicateDesign')}
                title={t('studio.duplicateDesign')}
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeleteOpen(true)}
                aria-label={t('studio.deleteDesign')}
                title={t('studio.deleteDesign')}
              >
                <Trash2 className="size-3.5 text-accent" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Workspace */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_324px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex items-stretch">
            {/* Tool rail */}
            <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-e border-line bg-surface-muted py-2">
              {tools.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(item.id)}
                  title={`${t(item.key)} (${item.shortcut})`}
                  aria-label={t(item.key)}
                  aria-pressed={tool === item.id}
                  className={cn(
                    'grid size-8 place-items-center rounded-md transition-colors',
                    tool === item.id
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted hover:bg-white hover:text-ink',
                  )}
                >
                  {item.icon}
                </button>
              ))}
              <div className="my-1 h-px w-6 bg-line" />
              <div className="relative my-0.5">
                <input
                  type="color"
                  value={paintColor}
                  onChange={(e) => {
                    setPaintColor(e.target.value.toUpperCase())
                    setTool('color')
                  }}
                  className={cn(
                    'size-6 cursor-pointer rounded-md border border-line p-0.5 shadow-xs transition',
                    tool === 'color' && 'ring-2 ring-accent ring-offset-1',
                  )}
                  title={t('studio.color')}
                />
              </div>
            </div>

            {/* Canvas */}
            <div className="relative min-w-0 flex-1 bg-[#F1F1EE]">
              <div
                ref={canvasWrapRef}
                className="h-[520px] overflow-auto p-5"
                style={{ backgroundImage: 'radial-gradient(#dcdcd7 1px, transparent 1px)', backgroundSize: '16px 16px' }}
              >
                {designQuery.isLoading ? (
                  <Skeleton className="h-[360px] w-full" />
                ) : (
                  <div className="inline-block rounded-[6px] bg-white p-0 shadow-[0_2px_14px_rgba(16,24,40,.10)]">
                    <WeaveCanvas
                      doc={doc}
                      tool={tool}
                      zoom={zoom}
                      guides={guides}
                      paintColor={paintColor}
                      onApply={(cells, value, color) => {
                        editor.applyCells(cells, value, color)
                        if (color) setPaintColor(color)
                      }}
                      onPickCell={(r, c) => {
                        const override = doc.cellColors[r]?.[c]
                        if (override) setPaintColor(override)
                        else setPaintColor(doc.weaveData[r]?.[c] === 1 ? doc.warpColors[c] : doc.weftColors[r])
                      }}
                      onHeaderClick={openThreadPicker}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-3 py-2">
                <div className="flex items-center gap-1 text-[10.5px] text-muted">
                  <span className="hidden sm:inline">{t('studio.canvasHint')}</span>
                  <span className="hidden sm:inline text-line-strong">·</span>
                  <span>
                    {doc.warpEnds} × {doc.weftPicks}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
                    className="grid size-7 place-items-center rounded-md border border-line text-muted hover:text-ink"
                    aria-label={t('studio.zoomOut')}
                  >
                    <ZoomOut className="size-3.5" />
                  </button>
                  <span className="w-10 text-center text-[10.5px] tabular-nums text-muted">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
                    className="grid size-7 place-items-center rounded-md border border-line text-muted hover:text-ink"
                    aria-label={t('studio.zoomIn')}
                  >
                    <ZoomIn className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={fitZoom}
                    className="ms-1 inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[10.5px] text-muted hover:text-ink"
                  >
                    <Maximize2 className="size-3" />
                    {t('studio.fit')}
                  </button>
                  {saveMutation.isPending && (
                    <span className="ms-2 flex items-center gap-1 text-[10.5px] text-muted">
                      <Loader2 className="size-3 animate-spin" />
                      {t('common.saving')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

          <LoomDraftingPanel
            weaveData={doc.weaveData}
            warpEnds={doc.warpEnds}
            weftPicks={doc.weftPicks}
            warpColors={doc.warpColors}
            weftColors={doc.weftColors}
          />
        </div>

        {/* Inspector */}
        <Card className="flex flex-col overflow-hidden xl:sticky xl:top-[68px] xl:self-start">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'grid', label: t('studio.grid'), icon: <Grid3x3 className="size-3.5" /> },
              { value: 'weave', label: t('studio.weave'), icon: <Layers className="size-3.5" /> },
              { value: 'color', label: t('studio.color'), icon: <Palette className="size-3.5" /> },
              { value: 'repeat', label: t('studio.repeat'), icon: <Repeat2 className="size-3.5" /> },
            ]}
            className="px-2"
          />

          <div className="max-h-[560px] space-y-4 overflow-y-auto p-4">
            {tab === 'grid' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('studio.warpEnds')}>
                    <Input
                      type="number"
                      min={2}
                      max={isPro ? 100 : 16}
                      value={sizeWarp}
                      onChange={(e) => setSizeWarp(Number(e.target.value))}
                      dir="ltr"
                    />
                  </Field>
                  <Field label={t('studio.weftPicks')}>
                    <Input
                      type="number"
                      min={2}
                      max={isPro ? 100 : 16}
                      value={sizeWeft}
                      onChange={(e) => setSizeWeft(Number(e.target.value))}
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Button size="sm" variant="secondary" className="w-full" onClick={applySize}>
                  {t('studio.applySize')}
                </Button>
                {!isPro && (
                  <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted">
                    <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
                    {t('studio.freeLimitNote')}
                  </p>
                )}

                <div className="h-px bg-line" />

                <Switch
                  checked={guides.show}
                  onChange={(show) => setGuides((g) => ({ ...g, show }))}
                  label={t('studio.guidesEvery')}
                  description={t('studio.repeatHint')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('studio.guidesEvery')}>
                    <Input
                      type="number"
                      min={2}
                      max={50}
                      value={guides.every}
                      onChange={(e) => setGuides((g) => ({ ...g, every: Math.max(2, Number(e.target.value)) }))}
                      dir="ltr"
                    />
                  </Field>
                  <Field label={t('studio.guideThickness')}>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      value={guides.thickness}
                      onChange={(e) =>
                        setGuides((g) => ({ ...g, thickness: clamp(Number(e.target.value) || 1, 1, 4) }))
                      }
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Field label={t('studio.guideColor')}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={guides.color.startsWith('#') ? guides.color : '#D92D20'}
                      onChange={(e) => setGuides((g) => ({ ...g, color: e.target.value }))}
                      className="h-8 w-12 cursor-pointer rounded-md border border-line bg-white p-0.5"
                      aria-label={t('studio.guideColor')}
                    />
                    <span className="text-[11px] text-muted">{t('studio.guideThickness')} {guides.thickness}px</span>
                  </div>
                </Field>

                <div className="rounded-lg border border-line bg-surface-muted p-2.5 text-[11px] text-muted">
                  {t('studio.cells', { w: doc.warpEnds, h: doc.weftPicks })}
                </div>
              </>
            )}

            {tab === 'weave' && (
              <>
                <Field label={t('studio.weaveType')}>
                  <Select value={weaveType} onChange={(e) => setWeaveType(e.target.value as WeaveType)}>
                    <option value="plain">{t('studio.plain')}</option>
                    <option value="rib">{t('studio.rib')}</option>
                    <option value="twill">{t('studio.twill')}</option>
                    <option value="satin">{t('studio.satin')}</option>
                    <option value="mockLeno">{t('studio.mockLeno')}</option>
                    <option value="honeycomb">{t('studio.honeycomb')}</option>
                    <option value="crepe">{t('studio.crepe')}</option>
                  </Select>
                </Field>

                {(weaveType === 'plain' || weaveType === 'twill' || weaveType === 'rib') && (
                  <Field label={t('studio.weave')} hint={t('studio.stripeHint')}>
                    <Input
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      dir="ltr"
                      placeholder="2/2"
                    />
                  </Field>
                )}

                {weaveType === 'twill' && (
                  <Field label={t('studio.twillDirection')}>
                    <Segmented
                      value={direction}
                      onChange={setDirection}
                      options={[
                        { value: 'Z', label: 'Z ↗' },
                        { value: 'S', label: 'S ↖' },
                      ]}
                      size="md"
                      className="w-full"
                    />
                  </Field>
                )}

                {weaveType === 'satin' && (
                  <Field label={t('studio.satinSize')}>
                    <Select
                      value={repeatSize}
                      onChange={(e) => setRepeatSize(Number(e.target.value))}
                    >
                      {[5, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                {['mockLeno', 'honeycomb', 'crepe'].includes(weaveType) && (
                  <Field label={t('studio.satinSize')}>
                    <Input
                      type="number"
                      min={4}
                      max={16}
                      value={repeatSize}
                      onChange={(e) => setRepeatSize(Number(e.target.value))}
                      dir="ltr"
                    />
                  </Field>
                )}

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    editor.applyGenerated(weaveType, {
                      pattern,
                      direction,
                      size: repeatSize,
                      satinSize: repeatSize,
                    })
                    toast.success(t('studio.gridUpdated'))
                  }}
                >
                  <Sparkles className="size-3.5" />
                  {t('studio.generate')}
                </Button>
                <p className="text-[10.5px] leading-4 text-muted">{t('studio.generateHint')}</p>

                <div className="h-px bg-line" />

                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    editor.update((current) => ({
                      ...current,
                      weaveData: current.weaveData.map((row) => row.map(() => 0)),
                      cellColors: current.cellColors.map((row) => row.map(() => null)),
                    }))
                    toast.success(t('studio.resetDone'))
                  }}
                >
                  {t('common.reset')}
                </Button>
              </>
            )}

            {tab === 'color' && (
              <>
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-ink-soft">{t('studio.warpPalette')}</p>
                  <div className="flex flex-wrap gap-1">
                    {doc.warpColors.map((color, index) => (
                      <ColorSwatch
                        key={`w-${index}`}
                        color={color}
                        size="sm"
                        label={`${t('share.warp')} ${index + 1}`}
                        onClick={() => openThreadPicker('warp', index)}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-muted">{t('studio.warpHint')}</p>
                </div>

                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-ink-soft">{t('studio.weftPalette')}</p>
                  <div className="flex flex-wrap gap-1">
                    {doc.weftColors.map((color, index) => (
                      <ColorSwatch
                        key={`f-${index}`}
                        color={color}
                        size="sm"
                        label={`${t('share.weft')} ${index + 1}`}
                        onClick={() => openThreadPicker('weft', index)}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-muted">{t('studio.weftHint')}</p>
                </div>

                <div className="h-px bg-line" />

                <div>
                  <p className="mb-2 text-[12px] font-medium text-ink-soft">{t('studio.stripes')}</p>
                  <div className="space-y-2">
                    <Segmented
                      value={stripeTarget}
                      onChange={setStripeTarget}
                      options={[
                        { value: 'warp', label: t('studio.stripeWarp') },
                        { value: 'weft', label: t('studio.stripeWeft') },
                      ]}
                      size="md"
                      className="w-full"
                    />
                    <Input
                      value={stripePattern}
                      onChange={(e) => setStripePattern(e.target.value)}
                      dir="ltr"
                      placeholder="4,2,2"
                      aria-label={t('studio.stripePattern')}
                    />
                    <div className="flex items-center gap-1.5">
                      {stripeColors.map((color, index) => (
                        <input
                          key={index}
                          type="color"
                          value={color}
                          onChange={(e) =>
                            setStripeColors((prev) =>
                              prev.map((c, i) => (i === index ? e.target.value : c)),
                            )
                          }
                          className="h-8 flex-1 cursor-pointer rounded-md border border-line bg-white p-0.5"
                          aria-label={`${t('studio.color')} ${index + 1}`}
                        />
                      ))}
                    </div>
                    <Button size="sm" variant="secondary" className="w-full" onClick={applyStripes}>
                      {t('studio.applyStripes')}
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-line" />

                <Button size="sm" variant="secondary" className="w-full" onClick={applyColorway}>
                  <Sparkles className="size-3.5" />
                  {t('studio.colorways')}
                </Button>
                <p className="text-[10.5px] leading-4 text-muted">{t('studio.colorwaysHint')}</p>
              </>
            )}

            {tab === 'repeat' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('studio.repeatWidth')}>
                    <Input
                      type="number"
                      min={1}
                      max={doc.warpEnds}
                      value={unitW}
                      onChange={(e) => setUnitW(clamp(Number(e.target.value) || 1, 1, doc.warpEnds))}
                      dir="ltr"
                    />
                  </Field>
                  <Field label={t('studio.repeatHeight')}>
                    <Input
                      type="number"
                      min={1}
                      max={doc.weftPicks}
                      value={unitH}
                      onChange={(e) => setUnitH(clamp(Number(e.target.value) || 1, 1, doc.weftPicks))}
                      dir="ltr"
                    />
                  </Field>
                </div>
                <Button size="sm" className="w-full" onClick={applyRepeat}>
                  <Repeat2 className="size-3.5" />
                  {t('studio.applyRepeat')}
                </Button>
                <p className="text-[10.5px] leading-4 text-muted">{t('studio.repeatHint')}</p>

                <div className="h-px bg-line" />

                <div className="rounded-lg border border-line bg-surface-muted p-3">
                  <p className="text-[11.5px] font-medium text-ink">{t('studio.size')}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {t('studio.cells', { w: doc.warpEnds, h: doc.weftPicks })}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <ThreadColorModal
        open={threadModalOpen}
        onClose={() => setThreadModalOpen(false)}
        target={threadModalTarget}
        onApplySingle={handleApplySingleThreadColor}
        onApplyAll={handleApplyAllThreadColor}
      />

      <SampleAnalyzerModal
        open={sampleScannerOpen}
        onClose={() => setSampleScannerOpen(false)}
        onApply={({ weaveData, warpEnds, weftPicks, warpColors, weftColors }) => {
          editor.update((current) => ({
            ...current,
            warpEnds,
            weftPicks,
            weaveData,
            cellColors: createColorMatrix(warpEnds, weftPicks),
            warpColors,
            weftColors,
          }))
          setSizeWarp(warpEnds)
          setSizeWeft(weftPicks)
        }}
      />

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('common.confirmDelete')}
        description={doc.name}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-muted">{t('common.deleteWarning')}</p>
      </Dialog>

      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={t('studio.shareDesign')}
        description={t('studio.shareHint')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShareOpen(false)}>
              {t('common.close')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl)
                toast.success(t('common.copied'))
              }}
            >
              {t('common.copy')}
            </Button>
          </>
        }
      >
        <Input readOnly value={shareUrl} dir="ltr" onFocus={(e) => e.target.select()} />
      </Dialog>

      <AutoWeaveDialog
        open={autoWeaveOpen}
        onClose={() => setAutoWeaveOpen(false)}
        warpEnds={doc.warpEnds}
        weftPicks={doc.weftPicks}
        onApply={(payload) => {
          applyWeavePayload(payload)
          toast.success(t('studio.weaveApplied'))
        }}
      />

      <DraftPlanModal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        draft={draft}
        weave={doc.weaveData}
        warpEnds={doc.warpEnds}
        weftPicks={doc.weftPicks}
        warpColors={doc.warpColors}
        weftColors={doc.weftColors}
      />

      <AssistantPanel
        context={{ locale: locale === 'ar' ? 'ar' : 'en', warpEnds: doc.warpEnds, weftPicks: doc.weftPicks }}
        onAction={runAssistantActions}
        onApplyWeave={applyWeavePayload}
      />

      <SimulationModal
        open={simulationOpen}
        onClose={() => setSimulationOpen(false)}
        spec={{
          warpEnds: doc.warpEnds,
          weftPicks: doc.weftPicks,
          weaveData: doc.weaveData,
          cellColors: doc.cellColors,
          warpColors: doc.warpColors,
          weftColors: doc.weftColors,
        }}
      />

      <MockupModal
        open={mockupOpen}
        onClose={() => setMockupOpen(false)}
        spec={{
          warpEnds: doc.warpEnds,
          weftPicks: doc.weftPicks,
          weaveData: doc.weaveData,
          cellColors: doc.cellColors,
          warpColors: doc.warpColors,
          weftColors: doc.weftColors,
        }}
      />

      <JacquardModal
        open={jacquardOpen}
        onClose={() => setJacquardOpen(false)}
        warpEnds={doc.warpEnds}
        weftPicks={doc.weftPicks}
        onApply={({ cellColors, weaveData }) => {
          editor.update((current) => ({
            ...current,
            cellColors,
            weaveData,
          }))
        }}
      />

      <CrossSectionModal
        open={crossSectionOpen}
        onClose={() => setCrossSectionOpen(false)}
        spec={{
          warpEnds: doc.warpEnds,
          weftPicks: doc.weftPicks,
          weaveData: doc.weaveData,
          warpColors: doc.warpColors,
          weftColors: doc.weftColors,
        }}
      />
    </div>
  )
}
