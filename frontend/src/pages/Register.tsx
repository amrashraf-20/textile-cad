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

export default function Register() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const register = useAuth((s) => s.register)

  const [fullName, setFullName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [accepted, setAccepted] = React.useState(false)
  const [show, setShow] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) {
      setError(t('common.name') + ' — ' + t('common.min'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.invalidEmail'))
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
    if (!accepted) {
      setError(t('auth.acceptTerms'))
      return
    }

    setLoading(true)
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        locale,
      })
      toast.success(t('common.success'))
      navigate(`/${locale}/welcome`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'email_taken') setError(t('auth.emailTaken'))
        else if (err.code === 'weak_password') setError(t('auth.weakPassword'))
        else if (err.code === 'invalid_email') setError(t('auth.invalidEmail'))
        else setError(t('auth.registerError'))
      } else {
        setError(t('common.networkError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <span>
          {t('auth.haveAccount')}{' '}
          <Link to={`/${locale}/login`} className="font-medium text-accent hover:underline">
            {t('auth.signIn')}
          </Link>
        </span>
      }
    >
      <form onSubmit={submit} noValidate>
        <FormError>{error}</FormError>

        <Field label={t('auth.fullName')} htmlFor="fullName" className="mb-4">
          <Input
            id="fullName"
            autoComplete="name"
            placeholder={t('auth.fullNamePlaceholder')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </Field>

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

        <Field
          label={t('common.password')}
          hint={t('auth.passwordHint')}
          htmlFor="password"
          className="mb-4"
        >
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
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

        <Field label={t('auth.confirmPassword')} htmlFor="confirm" className="mb-4">
          <Input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            dir="ltr"
            placeholder={t('auth.passwordPlaceholder')}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2 text-[11.5px] leading-5 text-muted">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 accent-[#D92D20]"
          />
          <span>{t('auth.acceptTerms')}</span>
        </label>

        <Button type="submit" size="lg" className="mt-5 w-full" loading={loading}>
          {t('auth.createAccount')}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Button>
      </form>
    </AuthLayout>
  )
}
