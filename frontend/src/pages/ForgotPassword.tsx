import * as React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MailCheck } from 'lucide-react'

import { AuthLayout, FormError } from './AuthLayout'
import { Button, Field, Input } from '@/components/ui'
import { apiClient } from '@/lib/api'
import { useLocale } from '@/lib/locale'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const locale = useLocale()

  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.invalidEmail'))
      return
    }
    setLoading(true)
    try {
      await apiClient.forgotPassword(email.trim())
      setSent(true)
    } catch {
      setError(t('common.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetSent')}
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
      {sent ? (
        <div className="rounded-[10px] border border-success/25 bg-success-soft px-4 py-5 text-center">
          <MailCheck className="mx-auto size-6 text-[#067647]" />
          <p className="mt-2 text-[13px] font-medium text-[#067647]">{t('auth.resetSent')}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <FormError>{error}</FormError>
          <Field label={t('common.email')} htmlFor="email" className="mb-4">
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {t('auth.resetPassword')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
