import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  UserRound,
  Globe2,
  ShieldCheck,
  Sparkles,
  Check,
  LogOut,
  KeyRound,
  Mail,
  CalendarDays,
  Layers,
  Grid3x3,
  Infinity as InfinityIcon,
  FileDown,
  Share2,
  Boxes,
  Sun,
  Moon,
  Cpu,
  ExternalLink,
  Key,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Segmented,
  Select,
  Switch,
} from '@/components/ui'
import { UpgradeDialog } from '@/components/UpgradeDialog'
import { api, apiClient, ApiError } from '@/lib/api'
import { useLocale, useSwitchLocale } from '@/lib/locale'
import { useAuth } from '@/store/auth'
import { cn, formatDate, formatNumber } from '@/lib/utils'
import { OPENROUTER_MODELS } from '@/features/studio/AssistantPanel'
import type { DashboardData, Settings as SettingsModel } from '@/lib/types'

function SectionCard({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-surface-muted text-ink-soft">
              {icon}
            </span>
            {title}
          </span>
        }
        subtitle={description}
      />
      <div className="p-4">{children}</div>
    </Card>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const settings = useAuth((s) => s.settings)
  const setUser = useAuth((s) => s.setUser)
  const setSettings = useAuth((s) => s.setSettings)
  const logout = useAuth((s) => s.logout)
  const switchLocale = useSwitchLocale()

  const [fullName, setFullName] = React.useState(user?.fullName ?? '')
  const [upgradeOpen, setUpgradeOpen] = React.useState(false)
  const [passwordForm, setPasswordForm] = React.useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  const [aiApiKey, setAiApiKey] = React.useState<string>(
    () => localStorage.getItem('openrouter_api_key') || '',
  )
  const [aiModel, setAiModel] = React.useState<string>(
    () => localStorage.getItem('openrouter_model') || 'meta-llama/llama-3.3-70b-instruct:free',
  )
  const [aiCustomModel, setAiCustomModel] = React.useState<string>(
    () => localStorage.getItem('openrouter_custom_model') || '',
  )
  const [aiTesting, setAiTesting] = React.useState(false)
  const [aiTestResult, setAiTestResult] = React.useState<{ ok: boolean; msg: string } | null>(null)

  const saveAi = (event: React.FormEvent) => {
    event.preventDefault()
    const clean = aiApiKey.trim()
    localStorage.setItem('openrouter_api_key', clean)
    localStorage.setItem('openrouter_model', aiModel)
    localStorage.setItem('openrouter_custom_model', aiCustomModel.trim())
    toast.success(t('settings.aiSaveSuccess'))
  }

  const testAi = async () => {
    const clean = aiApiKey.trim()
    if (!clean) {
      setAiTestResult({ ok: false, msg: t('settings.aiTestFailed') })
      return
    }
    setAiTesting(true)
    setAiTestResult(null)
    const effectiveModel = aiModel === 'custom' ? aiCustomModel.trim() : aiModel
    try {
      const res = await api<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say OK' }],
          apiKey: clean,
          model: effectiveModel || undefined,
        }),
      })
      if (res.reply) {
        setAiTestResult({ ok: true, msg: t('settings.aiTestSuccess') })
        localStorage.setItem('openrouter_api_key', clean)
        localStorage.setItem('openrouter_model', aiModel)
      }
    } catch {
      setAiTestResult({ ok: false, msg: t('settings.aiTestFailed') })
    } finally {
      setAiTesting(false)
    }
  }

  const isPro = user?.plan === 'pro' || user?.role === 'admin'

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
  })

  const current: SettingsModel =
    settings ?? {
      locale: user?.locale ?? locale,
      theme: 'light',
      currency: 'EGP',
      notifications: {},
    }

  React.useEffect(() => {
    setFullName(user?.fullName ?? '')
  }, [user?.fullName])

  const profileMutation = useMutation({
    mutationFn: () => apiClient.updateMe({ fullName: fullName.trim() }),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success(t('settings.profileSaved'))
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'invalid_name') {
        toast.error(t('common.name') + ' — ' + t('common.min'))
        return
      }
      toast.error(t('settings.saveError'))
    },
  })

  const settingsMutation = useMutation({
    mutationFn: (next: SettingsModel) =>
      apiClient.updateSettings(next),
    onSuccess: (next) => {
      setSettings(next)
      if (next.locale !== user?.locale && user) {
        setUser({ ...user, locale: next.locale })
      }
      toast.success(t('settings.savedSettings'))
    },
    onError: () => toast.error(t('settings.saveError')),
  })

  const passwordMutation = useMutation({
    mutationFn: () => apiClient.changePassword(passwordForm.current, passwordForm.next),
    onSuccess: async () => {
      toast.success(t('settings.passwordUpdated'))
      await logout()
      navigate(`/${locale}/login`, { replace: true })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'invalid_password') {
        setPasswordError(t('settings.wrongPassword'))
      } else if (err instanceof ApiError && err.code === 'weak_password') {
        setPasswordError(t('auth.weakPassword'))
      } else {
        setPasswordError(t('common.unexpectedError'))
      }
    },
  })

  const signOutAll = useMutation({
    mutationFn: async () => {
      await apiClient.logoutAll()
      await logout()
    },
    onSuccess: () => {
      toast.success(t('settings.sessionRevoked'))
      navigate(`/${locale}/login`, { replace: true })
    },
    onError: () => toast.error(t('common.unexpectedError')),
  })

  const patchSettings = (patch: Partial<SettingsModel>) => {
    const next: SettingsModel = {
      locale: current.locale,
      theme: current.theme,
      currency: current.currency,
      notifications: current.notifications ?? {},
      ...patch,
    }
    settingsMutation.mutate(next)
  }

  const onPasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    if (passwordForm.next.length < 10 || !/[A-Za-z]/.test(passwordForm.next) || !/[0-9]/.test(passwordForm.next)) {
      setPasswordError(t('auth.weakPassword'))
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError(t('auth.passwordMismatch'))
      return
    }
    passwordMutation.mutate()
  }

  const notifications = (current.notifications ?? {}) as Record<string, boolean>

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {/* Profile */}
          <SectionCard
            icon={<UserRound className="size-3.5" />}
            title={t('settings.profile')}
            description={t('settings.profileDesc')}
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
              <span className="grid size-12 place-items-center rounded-full bg-sidebar text-[15px] font-semibold text-white">
                {(user?.fullName ?? 'TC')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join('') || 'TC'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{user?.fullName}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Mail className="size-3" />
                  <span dir="ltr">{user?.email}</span>
                </p>
              </div>
              <div className="ms-auto flex flex-wrap items-center gap-1.5">
                <Badge tone={isPro ? 'accent' : 'neutral'}>
                  {user?.role === 'admin'
                    ? t('settings.planAdmin')
                    : isPro
                      ? t('settings.planPro')
                      : t('settings.planFree')}
                </Badge>
                {user?.createdAt && (
                  <Badge tone="neutral">
                    <CalendarDays className="size-2.5" />
                    {t('settings.memberSince', { date: formatDate(user.createdAt, locale) })}
                  </Badge>
                )}
              </div>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                profileMutation.mutate()
              }}
            >
              <Field label={t('auth.fullName')} htmlFor="profile-name">
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={80}
                  autoComplete="name"
                />
              </Field>
              <Field label={t('common.email')} htmlFor="profile-email" hint={t('settings.emailReadonly')}>
                <Input id="profile-email" value={user?.email ?? ''} dir="ltr" readOnly disabled />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  loading={profileMutation.isPending}
                  disabled={fullName.trim().length < 2 || fullName.trim() === user?.fullName}
                >
                  {t('settings.saveProfile')}
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* Language & region */}
          <SectionCard
            icon={<Globe2 className="size-3.5" />}
            title={t('settings.languageRegion')}
            description={t('settings.languageDesc')}
          >
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-ink-soft">{t('common.language')}</p>
                <Segmented
                  value={locale}
                  onChange={(next) => {
                    switchLocale(next)
                    if (current.locale !== next) patchSettings({ locale: next })
                  }}
                  options={[
                    { value: 'ar', label: t('settings.arabicNative') },
                    { value: 'en', label: t('settings.englishNative') },
                  ]}
                  size="md"
                  className="w-full"
                />
                <p className="mt-1.5 text-[11px] text-muted">{t('settings.languageHint')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('common.currency')} htmlFor="currency">
                  <Select
                    id="currency"
                    value={current.currency}
                    onChange={(e) =>
                      patchSettings({ currency: e.target.value as SettingsModel['currency'] })
                    }
                  >
                    <option value="EGP">{t('settings.currencyEgp')}</option>
                    <option value="USD">{t('settings.currencyUsd')}</option>
                  </Select>
                </Field>
                <Field label={t('settings.appearance')} htmlFor="theme">
                  <Select
                    id="theme"
                    value="light"
                    disabled
                    onChange={() => undefined}
                  >
                    <option value="light">{t('settings.themeLight')}</option>
                    <option value="dark">{t('settings.themeDark')}</option>
                  </Select>
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[10.5px] text-muted">
                  <Sun className="size-3" />
                  {t('settings.themeLight')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1 text-[10.5px] text-muted/70">
                  <Moon className="size-3" />
                  {t('settings.themeSoon')}
                </span>
              </div>

              <p className="text-[11px] text-muted">{t('settings.regionNote')}</p>
            </div>
          </SectionCard>

          {/* Notifications */}
          <SectionCard
            icon={<Mail className="size-3.5" />}
            title={t('settings.notifications')}
            description={t('settings.notificationsDesc')}
          >
            <div className="space-y-3">
              <Switch
                checked={notifications.product ?? true}
                onChange={(checked) =>
                  patchSettings({ notifications: { ...notifications, product: checked } })
                }
                label={t('settings.notifProduct')}
              />
              <div className="h-px bg-line" />
              <Switch
                checked={notifications.security ?? true}
                onChange={(checked) =>
                  patchSettings({ notifications: { ...notifications, security: checked } })
                }
                label={t('settings.notifSecurity')}
              />
            </div>
          </SectionCard>

          {/* AI Assistant & Vision */}
          <SectionCard
            icon={<Cpu className="size-3.5" />}
            title={t('settings.aiSettings')}
            description={t('settings.aiSettingsDesc')}
          >
            <form className="space-y-3" onSubmit={saveAi}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('settings.aiModel')} htmlFor="ai-model">
                  <Select
                    id="ai-model"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                  >
                    {OPENROUTER_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={
                    <span className="flex items-center justify-between w-full">
                      <span>{t('settings.aiApiKey')}</span>
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10.5px] text-accent hover:underline"
                      >
                        {t('settings.aiFreeKeyLink')}
                        <ExternalLink className="size-2.5" />
                      </a>
                    </span>
                  }
                  htmlFor="ai-api-key"
                >
                  <Input
                    id="ai-api-key"
                    type="password"
                    dir="ltr"
                    placeholder={t('settings.aiApiKeyPlaceholder')}
                    value={aiApiKey}
                    onChange={(e) => {
                      setAiApiKey(e.target.value)
                      setAiTestResult(null)
                    }}
                  />
                </Field>
              </div>

              {aiModel === 'custom' && (
                <Field label="Custom OpenRouter Model ID" htmlFor="ai-custom-model">
                  <Input
                    id="ai-custom-model"
                    dir="ltr"
                    placeholder="e.g. meta-llama/llama-3.1-8b-instruct:free"
                    value={aiCustomModel}
                    onChange={(e) => setAiCustomModel(e.target.value)}
                  />
                </Field>
              )}

              {aiTestResult && (
                <p
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[12px]',
                    aiTestResult.ok
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-accent/25 bg-accent-soft text-accent',
                  )}
                >
                  {aiTestResult.msg}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testAi}
                  loading={aiTesting}
                >
                  <Key className="size-3.5" />
                  {t('settings.aiTestConnection')}
                </Button>
                <Button type="submit" size="sm">
                  <Check className="size-3.5" />
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </SectionCard>

          {/* Security */}
          <SectionCard
            icon={<ShieldCheck className="size-3.5" />}
            title={t('settings.security')}
            description={t('settings.securityDesc')}
          >
            <form className="space-y-3" onSubmit={onPasswordSubmit}>
              {passwordError && (
                <p className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-[12px] text-accent">
                  {passwordError}
                </p>
              )}
              <Field label={t('settings.currentPassword')} htmlFor="current-password">
                <Input
                  id="current-password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                  required
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t('settings.newPassword')}
                  hint={t('auth.passwordHint')}
                  htmlFor="new-password"
                >
                  <Input
                    id="new-password"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                    required
                  />
                </Field>
                <Field label={t('settings.confirmNew')} htmlFor="confirm-password">
                  <Input
                    id="confirm-password"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))
                    }
                    required
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={passwordMutation.isPending}>
                  <KeyRound className="size-3.5" />
                  {t('settings.updatePassword')}
                </Button>
              </div>
              <p className="text-[11px] text-muted">{t('settings.securityNote')}</p>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted px-3 py-2.5">
              <div>
                <p className="text-[12px] font-medium text-ink">{t('settings.sessions')}</p>
                <p className="mt-0.5 text-[11px] text-muted">{t('settings.sessionsDesc')}</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => signOutAll.mutate()}
                loading={signOutAll.isPending}
              >
                <LogOut className="size-3.5 rtl:rotate-180" />
                {t('settings.signOutAll')}
              </Button>
            </div>
          </SectionCard>
        </div>

        {/* Plan */}
        <div className="space-y-4">
          <Card className="overflow-hidden xl:sticky xl:top-[68px]">
            <div className="border-b border-line bg-sidebar px-4 py-4 text-white">
              <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-white/50">
                <Sparkles className="size-3" />
                {t('settings.currentPlan')}
              </p>
              <p className="mt-1.5 text-[19px] font-semibold">
                {user?.role === 'admin'
                  ? t('settings.planAdmin')
                  : isPro
                    ? t('settings.planPro')
                    : t('settings.planFree')}
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn('h-full rounded-full', isPro ? 'w-full bg-success' : 'w-1/3 bg-accent')}
                />
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{t('dashboard.kpiDesigns')}</span>
                  <span className="font-medium tabular-nums text-ink">
                    {t('settings.designsUsage', {
                      used: dashboardQuery.data?.counts.designs ?? 0,
                      limit: isPro ? '∞' : 5,
                    })}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#EDEDE9]">
                  <div
                    className={cn('h-full rounded-full', isPro ? 'bg-success' : 'bg-accent')}
                    style={{
                      width: isPro
                        ? '100%'
                        : `${Math.min(100, ((dashboardQuery.data?.counts.designs ?? 0) / 5) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">{t('studio.grid')}</span>
                <span className="font-medium text-ink">
                  {t('settings.gridUsage', { grid: isPro ? 100 : 16 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">{t('dashboard.kpiYarns')}</span>
                <span className="font-medium tabular-nums text-ink">
                  {formatNumber(dashboardQuery.data?.counts.yarns ?? 0, locale)} / {isPro ? '∞' : 20}
                </span>
              </div>

              <div className="h-px bg-line" />

              <div>
                <p className="mb-2 text-[11.5px] font-semibold text-ink">
                  {isPro ? t('settings.proFeatures') : t('settings.freeFeatures')}
                </p>
                <ul className="space-y-1.5">
                  {[
                    {
                      icon: <Grid3x3 className="size-3.5" />,
                      label: t('settings.gridUsage', { grid: isPro ? 100 : 16 }),
                    },
                    {
                      icon: <InfinityIcon className="size-3.5" />,
                      label: t('settings.planFeatureUnlimited'),
                      pro: true,
                    },
                    {
                      icon: <FileDown className="size-3.5" />,
                      label: t('settings.planFeatureWif'),
                      pro: true,
                    },
                    {
                      icon: <Boxes className="size-3.5" />,
                      label: t('settings.planFeatureErp'),
                      pro: true,
                    },
                    {
                      icon: <Share2 className="size-3.5" />,
                      label: t('settings.planFeatureShare'),
                      pro: true,
                    },
                    {
                      icon: <Layers className="size-3.5" />,
                      label: t('settings.planFeatureSupport'),
                      pro: true,
                    },
                  ].map((feature) => {
                    const locked = feature.pro && !isPro
                    return (
                      <li
                        key={feature.label}
                        className={cn(
                          'flex items-center gap-2 text-[11.5px]',
                          locked ? 'text-muted/60' : 'text-ink-soft',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-4 shrink-0 place-items-center rounded-full',
                            locked ? 'bg-surface-muted text-muted/60' : 'bg-success-soft text-[#067647]',
                          )}
                        >
                          {locked ? feature.icon : <Check className="size-2.5" strokeWidth={3} />}
                        </span>
                        {feature.label}
                      </li>
                    )
                  })}
                </ul>
              </div>

              {!isPro && (
                <Button className="w-full" size="sm" onClick={() => setUpgradeOpen(true)}>
                  <Sparkles className="size-3.5" />
                  {t('settings.upgradePro')}
                </Button>
              )}
              <p className="text-center text-[10.5px] text-muted">{t('settings.upgradeNote')}</p>
            </div>
          </Card>
        </div>
      </div>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}
