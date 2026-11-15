import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  ImagePlus,
  Send,
  Sparkles,
  X,
  Loader2,
  Settings2,
  Key,
  Check,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useLocale } from '@/lib/locale'
import { cn } from '@/lib/utils'
import {
  localAssistant,
  sanitizeActions,
  type AssistantAction,
  type AssistantContext,
} from './assistant'
import type { ApplyWeavePayload } from './AutoWeaveDialog'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  image?: string
  pending?: boolean
}

interface AiChatResponse {
  reply: string
  actions?: unknown
  model?: string
}

interface AiAnalyzeResponse {
  reply: string
  weave: number[][]
  warpEnds: number
  weftPicks: number
  warpColor?: string
  weftColor?: string
  structureId?: string
  confidence?: number
}

export const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free - Top Performance)' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free - Fast & Vision)' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free - Complex Reasoning)' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (Free - Arabic & English)' },
  { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small 24B (Free)' },
  { id: 'custom', name: 'Custom Model ID...' },
]

const QUICK_PROMPTS: { ar: string; en: string }[] = [
  { ar: 'اعمل تركيب مبرد 2/2', en: 'Apply a 2/2 twill' },
  { ar: 'اعملي قماش جينز كحلي', en: 'Make denim fabric' },
  { ar: 'اعمل قماش قرص العسل', en: 'Apply honeycomb' },
  { ar: 'لون السداء كحلي واللحمة كريمي', en: 'Navy warp, cream weft' },
  { ar: 'ما الفرق بين المبرد والساتان؟', en: 'Difference between twill and satin?' },
  { ar: 'افتح مخطط النسج واللوح', en: 'Open the draft plan' },
  { ar: 'افتح الحسابات الفنية', en: 'Open calculations' },
]

function uid() {
  return Math.random().toString(36).slice(2)
}

export function AssistantPanel({
  context,
  onAction,
  onApplyWeave,
}: {
  context: AssistantContext
  onAction: (actions: AssistantAction[]) => void
  onApplyWeave: (payload: ApplyWeavePayload) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const ar = locale === 'ar'

  const [open, setOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [image, setImage] = React.useState<string | null>(null)
  const [online, setOnline] = React.useState<boolean | null>(null)
  const fileRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef<HTMLDivElement | null>(null)

  // AI Configuration state
  const [showSettings, setShowSettings] = React.useState(false)
  const [apiKey, setApiKey] = React.useState<string>(() => localStorage.getItem('openrouter_api_key') || '')
  const [model, setModel] = React.useState<string>(
    () => localStorage.getItem('openrouter_model') || 'meta-llama/llama-3.3-70b-instruct:free',
  )
  const [customModel, setCustomModel] = React.useState<string>(
    () => localStorage.getItem('openrouter_custom_model') || '',
  )
  const [showKey, setShowKey] = React.useState(false)
  const [testingKey, setTestingKey] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ ok: boolean; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    api<{ enabled: boolean }>('/ai/status')
      .then((r) => {
        if (!cancelled) setOnline(r.enabled)
      })
      .catch(() => {
        if (!cancelled) setOnline(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    setMessages([
      {
        id: uid(),
        role: 'assistant',
        text: ar
          ? 'أهلاً بك يا باشمهندس! أنا مساعد النسيج والذكاء الاصطناعي في الاستوديو. جاهز لمساعدتك في إنشاء التراكيب النسجية، تلوين الخيوط، مخططات اللوح (Dobby & Loom Drafting)، أو إجراء الحسابات الفنية. يمكنك أيضاً إرفاق صورة لعينة قماش وسأحللها وأبني تركيبها.'
          : 'Welcome! I am your textile engineering AI assistant. I can apply weave structures, set warp and weft yarns, generate loom drafting plans (shafts & tie-up), or compute technical fabric GSM and density. You can also attach a sample photo to reconstruct its weave repeat.',
      },
    ])
    setInput('')
    setImage(null)
  }, [ar])

  React.useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy, showSettings])

  const push = (m: Omit<Message, 'id'>) => {
    const msg = { ...m, id: uid() }
    setMessages((prev) => [...prev, msg])
    return msg.id
  }

  const saveAiSettings = () => {
    const cleanKey = apiKey.trim()
    localStorage.setItem('openrouter_api_key', cleanKey)
    localStorage.setItem('openrouter_model', model)
    localStorage.setItem('openrouter_custom_model', customModel.trim())
    toast.success(ar ? 'تم حفظ إعدادات الذكاء الاصطناعي بنجاح' : 'AI settings saved successfully')
    setShowSettings(false)
  }

  const testAiConnection = async () => {
    const cleanKey = apiKey.trim()
    if (!cleanKey) {
      setTestResult({
        ok: false,
        msg: ar ? 'يرجى إدخال مفتاح API أولاً' : 'Please enter an API key first',
      })
      return
    }
    setTestingKey(true)
    setTestResult(null)
    const effectiveModel = model === 'custom' ? customModel.trim() : model
    try {
      const res = await api<AiChatResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Respond with: OK' }],
          apiKey: cleanKey,
          model: effectiveModel || undefined,
          context,
        }),
      })
      if (res.reply) {
        setTestResult({
          ok: true,
          msg: ar
            ? `اتصال ناجح بنموذج ${effectiveModel}!`
            : `Successfully connected to ${effectiveModel}!`,
        })
        localStorage.setItem('openrouter_api_key', cleanKey)
        localStorage.setItem('openrouter_model', model)
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      let msg = ar ? 'تعذّر الاتصال بمزود الذكاء الاصطناعي' : 'Could not connect to AI provider'
      if (code === 'invalid_api_key') {
        msg = ar ? 'مفتاح API غير صالح أو منتهي الصلاحية' : 'Invalid or expired API key'
      } else if (code === 'quota_exceeded') {
        msg = ar ? 'تم استهلاك رصيد المفتاح أو الحصة المتاحة' : 'API key quota reached'
      }
      setTestResult({ ok: false, msg })
    } finally {
      setTestingKey(false)
    }
  }

  const send = async (text: string) => {
    const clean = text.trim()
    if (!clean || busy) return
    setInput('')
    push({ role: 'user', text: clean })

    const effectiveKey = apiKey.trim()
    const effectiveModel = model === 'custom' ? customModel.trim() : model

    // If an API key is set OR the server backend has AI enabled
    if (effectiveKey || online === true) {
      setBusy(true)
      const pendingId = push({ role: 'assistant', text: '', pending: true })
      try {
        const history = messages
          .filter((m) => !m.pending)
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.text }))
        const res = await api<AiChatResponse>('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({
            messages: [...history, { role: 'user', content: clean }],
            apiKey: effectiveKey || undefined,
            model: effectiveModel || undefined,
            context,
          }),
        })
        const actions = sanitizeActions(res.actions)
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, text: res.reply, pending: false } : m)),
        )
        if (actions.length) onAction(actions)
      } catch (err) {
        const code = err instanceof ApiError ? err.code : ''
        let notice = ''
        if (code === 'invalid_api_key') {
          notice = ar
            ? '⚠️ مفتاح OpenRouter غير صالح أو منتهي. تم الرد عبر المحرك المحلي. اضغط ⚙️ بالأعلى لإدخال مفتاح سارٍ.'
            : '⚠️ OpenRouter API key is invalid. Switched to local engine. Click ⚙️ above to update.'
        } else if (code === 'quota_exceeded') {
          notice = ar
            ? '⚠️ انتهت الحصة المخصصة للنموذج على OpenRouter. تم الرد عبر المحرك المحلي.'
            : '⚠️ OpenRouter quota reached. Switched to local engine.'
        }

        // Instant, intelligent local textile fallback
        const local = localAssistant(clean, context)
        const combined = notice ? `${notice}\n\n${local.reply}` : local.reply
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, text: combined, pending: false } : m)),
        )
        if (local.actions.length) onAction(local.actions)
      } finally {
        setBusy(false)
      }
      return
    }

    // Local smart engine when no key is configured
    const local = localAssistant(clean, context)
    push({ role: 'assistant', text: local.reply })
    if (local.actions.length) onAction(local.actions)
  }

  const attach = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(ar ? 'الملف ليس صورة' : 'That file is not an image')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(ar ? 'حجم الصورة أكبر من 8 ميجابايت' : 'Image is larger than 8 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!image || busy) return
    setBusy(true)
    push({
      role: 'user',
      text: ar ? 'حلّل هذه العينة وابنِ تركيبها.' : 'Analyse this sample and build its structure.',
      image,
    })
    const pendingId = push({ role: 'assistant', text: '', pending: true })
    const effectiveKey = apiKey.trim()
    const visionModel = 'google/gemini-2.0-flash-exp:free'
    try {
      const res = await api<AiAnalyzeResponse>('/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          image,
          warpEnds: context.warpEnds,
          weftPicks: context.weftPicks,
          apiKey: effectiveKey || undefined,
          model: visionModel,
          locale: ar ? 'ar' : 'en',
        }),
      })
      onApplyWeave({
        weaveData: res.weave,
        warpColors: res.warpColor ? Array(res.warpEnds).fill(res.warpColor) : undefined,
        weftColors: res.weftColor ? Array(res.weftPicks).fill(res.weftColor) : undefined,
        structureId: res.structureId,
      })
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { ...m, text: res.reply, pending: false } : m)),
      )
      setImage(null)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      let message: string
      if (ar) {
        if (code === 'image_too_large') message = 'الصورة أكبر من 12 ميجابايت. اختر صورة أصغر.'
        else if (code === 'invalid_image' || code === 'missing_image')
          message = 'تعذّر قراءة الصورة. استخدم PNG أو JPEG واضح.'
        else if (code === 'rate_limited') message = 'طلبات كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة.'
        else message = 'تعذّر تحليل الصورة. جرّب صورة أوضح وإضاءة أفضل.'
      } else {
        if (code === 'image_too_large') message = 'That image is larger than 12 MB. Choose a smaller one.'
        else if (code === 'invalid_image' || code === 'missing_image')
          message = 'That image could not be read. Use a clear PNG or JPEG.'
        else if (code === 'rate_limited') message = 'Too many requests. Wait a minute and try again.'
        else message = 'Could not analyse the image. Try a sharper photo with even lighting.'
      }
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, text: message, pending: false } : m)))
    } finally {
      setBusy(false)
    }
  }

  const hasApiKey = Boolean(apiKey.trim())
  const activeModelShortName = hasApiKey
    ? model.split('/').pop()?.replace(':free', '') || 'Llama 3.3'
    : ar
      ? 'المحرك الذكي'
      : 'Local Engine'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('assistant.title', 'Assistant')}
        className={cn(
          'fixed bottom-5 end-5 z-40 grid size-13 place-items-center rounded-full bg-accent text-white shadow-[0_10px_30px_rgba(217,45,32,.35)] transition hover:scale-105',
          open && 'scale-0 opacity-0',
        )}
        style={{ width: 52, height: 52 }}
      >
        <Bot className="size-6" />
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex h-[min(650px,calc(100vh-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_70px_rgba(16,24,40,.28)] sm:inset-x-auto sm:end-5 sm:bottom-5 sm:w-[420px]">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-muted px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-white">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-ink">
                  {t('assistant.title', 'Studio Assistant')}
                </p>
                <div className="flex items-center gap-1.5 text-[10.5px]">
                  <span
                    className={cn(
                      'inline-block size-2 rounded-full',
                      hasApiKey ? 'bg-emerald-500' : 'bg-blue-500',
                    )}
                  />
                  <span className="truncate text-ink-soft">
                    {hasApiKey ? `AI: ${activeModelShortName}` : activeModelShortName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className={cn(
                  'grid size-7 place-items-center rounded-md transition',
                  showSettings
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-muted hover:bg-white hover:text-ink',
                )}
                title={ar ? 'إعدادات الذكاء الاصطناعي والموديل' : 'AI Model & Key Settings'}
              >
                <Settings2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-7 place-items-center rounded-md text-muted hover:bg-white hover:text-ink"
                aria-label={t('common.close')}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* AI Settings Drawer */}
          {showSettings && (
            <div className="border-b border-line bg-slate-50/80 p-3 text-[12px] space-y-2.5 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-accent" />
                  {ar ? 'إعدادات الذكاء الاصطناعي (OpenRouter)' : 'OpenRouter AI Configuration'}
                </span>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-accent hover:underline font-medium"
                >
                  {ar ? 'مفتاح مجاني' : 'Get Free Key'}
                  <ExternalLink className="size-2.5" />
                </a>
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1">
                  {ar ? 'نموذج الذكاء الاصطناعي (AI Model)' : 'AI Model'}
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-accent"
                >
                  {OPENROUTER_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {model === 'custom' && (
                <div>
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. meta-llama/llama-3.1-8b-instruct:free"
                    className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-accent"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-muted mb-1 flex items-center justify-between">
                  <span>{ar ? 'مفتاح API (OpenRouter Key)' : 'OpenRouter API Key'}</span>
                  {hasApiKey && (
                    <span className="text-[10px] text-emerald-600 font-medium">
                      ✓ {ar ? 'مضبوط' : 'Configured'}
                    </span>
                  )}
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="sk-or-v1-..."
                    className="w-full rounded-md border border-line bg-white px-2 py-1.5 pe-8 text-[11.5px] font-mono text-ink outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute end-2 text-muted hover:text-ink"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </div>

              {testResult && (
                <div
                  className={cn(
                    'rounded-md p-2 text-[11px] flex items-center gap-1.5',
                    testResult.ok
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200',
                  )}
                >
                  {testResult.ok ? (
                    <Check className="size-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="size-3.5 shrink-0" />
                  )}
                  <span>{testResult.msg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testAiConnection}
                  loading={testingKey}
                  className="h-7 text-[11px] px-2.5"
                >
                  <Key className="size-3" />
                  {ar ? 'اختبار المفتاح' : 'Test Key'}
                </Button>
                <Button size="sm" onClick={saveAiSettings} className="h-7 text-[11px] px-2.5">
                  <Check className="size-3" />
                  {ar ? 'حفظ وإغلاق' : 'Save & Close'}
                </Button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-xl px-3 py-2 text-[12px] leading-5',
                    m.role === 'user'
                      ? 'bg-accent text-white shadow-sm'
                      : 'border border-line bg-surface-muted text-ink-soft',
                  )}
                >
                  {m.image && (
                    <img
                      src={m.image}
                      alt="sample"
                      className="mb-1.5 max-h-32 rounded-md border border-white/30 object-cover"
                    />
                  )}
                  {m.pending ? (
                    <span className="flex items-center gap-1.5 text-muted">
                      <Loader2 className="size-3 animate-spin" />
                      {ar ? 'جارٍ التحليل والتفكير…' : 'Thinking & analyzing…'}
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Image Attachment Preview */}
          {image && (
            <div className="flex items-center gap-2 border-t border-line px-3 py-2 bg-slate-50/50">
              <img
                src={image}
                alt="preview"
                className="size-10 rounded-md border border-line object-cover"
              />
              <Button size="sm" className="flex-1" onClick={analyze} loading={busy}>
                <ImagePlus className="size-3.5" />
                {t('assistant.analyse', 'Analyse sample')}
              </Button>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="grid size-8 place-items-center rounded-md border border-line text-muted hover:text-ink"
                aria-label={t('common.remove', 'Remove')}
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Input & Quick Prompts */}
          <div className="border-t border-line p-2.5">
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.en}
                  type="button"
                  onClick={() => void send(ar ? p.ar : p.en)}
                  className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-ink-soft hover:border-accent/50 hover:text-accent transition"
                >
                  {ar ? p.ar : p.en}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) attach(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-ink transition"
                aria-label={t('assistant.attach', 'Attach sample photo')}
              >
                <ImagePlus className="size-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                placeholder={t('assistant.placeholder', 'Ask or command…')}
                className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-[12px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || busy}
                aria-label={t('assistant.send', 'Send')}
              >
                <Send className="size-4 rtl:-scale-x-100" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
