import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import { AuthLayout, FormError } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { useLocale } from '@/lib/locale'
import { useAuth } from '@/store/auth'

export default function Login() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError(t('auth.invalidCredentials'))
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      toast.success(t('common.success'))
      // First sign-in on this device shows the explanation page once.
      const account = useAuth.getState().user
      const onboarded = account
        ? localStorage.getItem(`tc_onboarded_${account.id}`) === '1'
        : true
      navigate(`/${locale}/${onboarded ? 'app/dashboard' : 'welcome'}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'invalid_credentials') setError(t('auth.invalidCredentials'))
        else if (err.code === 'rate_limited') setError(t('errors.tryAgain'))
        else setError(t('auth.loginError'))
      } else {
        setError(t('common.networkError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <span>
          {t('auth.noAccount')}{' '}
          <Link
            to={`/${locale}/register`}
            className="font-medium text-accent hover:underline"
          >
            {t('auth.createAccount')}
          </Link>
        </span>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError>{error}</FormError>

        <Field label={t('common.email')} htmlFor="email" className="mb-4">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field htmlFor="password" className="mb-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-[12px] font-medium text-ink-soft">
              {t('common.password')}
            </label>
            <Link
              to={`/${locale}/forgot-password`}
              className="text-[11.5px] text-muted transition-colors hover:text-accent"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              dir="ltr"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:text-ink"
              aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" className="mt-5 w-full" loading={loading}>
          {t('auth.signIn')}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>

        <div className="mt-5 flex items-center gap-3 text-[10.5px] uppercase tracking-wider text-muted/70">
          <span className="h-px flex-1 bg-line" />
          {t('auth.demoNote')}
          <span className="h-px flex-1 bg-line" />
        </div>
      </form>
    </AuthLayout>
  )
}
