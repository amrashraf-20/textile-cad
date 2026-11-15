import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { AuthLayout, FormError } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { apiClient, ApiError } from '@/lib/api'
import { useLocale } from '@/lib/locale'

export default function ResetPassword() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!token) {
      setError(t('auth.invalidToken'))
      return
    }
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t('auth.weakPassword'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setLoading(true)
    try {
      await apiClient.resetPassword(token, password)
      toast.success(t('auth.resetDone'))
      navigate(`/${locale}/login`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_token') setError(t('auth.invalidToken'))
      else setError(t('common.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle')}
      footer={
        <Link
          to={`/${locale}/login`}
          className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {t('auth.backToLogin')}
        </Link>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError>{error || (!token ? t('auth.invalidToken') : null)}</FormError>

        <Field label={t('auth.newPassword')} htmlFor="password" hint={t('auth.passwordHint')} className="mb-4">
          <Input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Field label={t('auth.confirmPassword')} htmlFor="confirm" className="mb-4">
          <Input
            id="confirm"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!token}>
          {t('auth.resetPassword')}
        </Button>
      </form>
    </AuthLayout>
  )
}
