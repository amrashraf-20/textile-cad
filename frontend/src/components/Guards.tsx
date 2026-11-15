import * as React from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import i18n, { detectLocale } from '@/lib/i18n'
import { useAuth } from '@/store/auth'
import { PageLoader } from './ui'

/** Validates the `:locale` segment and keeps <html lang/dir> in sync. */
export function LocaleGate() {
  const { locale } = useParams()
  const location = useLocation()

  React.useEffect(() => {
    if (locale === 'ar' || locale === 'en') {
      if (i18n.language !== locale) void i18n.changeLanguage(locale)
    }
  }, [locale])

  if (locale !== 'ar' && locale !== 'en') {
    const target = `/${detectLocale()}${location.pathname}${location.search}`
    return <Navigate to={target} replace />
  }

  return <Outlet />
}

export function Protected() {
  const { t } = useTranslation()
  const { locale } = useParams()
  const status = useAuth((s) => s.status)
  const location = useLocation()

  if (status === 'loading') return <PageLoader label={t('loading.account')} />

  if (status === 'anon') {
    return (
      <Navigate
        to={`/${locale ?? 'ar'}/login`}
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return <Outlet />
}

export function RootRedirect() {
  return <Navigate to={`/${detectLocale()}/app/dashboard`} replace />
}
