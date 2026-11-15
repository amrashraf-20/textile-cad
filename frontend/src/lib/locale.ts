import { useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import i18n from './i18n'
import { apiClient } from './api'
import { useAuth } from '@/store/auth'
import type { Locale } from './types'

export function normalizeLocale(value: string | undefined): Locale {
  return value === 'en' ? 'en' : 'ar'
}

export function useLocale(): Locale {
  const { locale } = useParams()
  return normalizeLocale(locale)
}

/** Switches language, keeps the current route and persists it for signed-in users. */
export function useSwitchLocale() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    (next: Locale) => {
      void i18n.changeLanguage(next)
      const segments = location.pathname.split('/').filter(Boolean)
      if (segments[0] === 'ar' || segments[0] === 'en') {
        segments[0] = next
      } else {
        segments.unshift(next)
      }
      navigate(`/${segments.join('/')}${location.search}`, { replace: true })

      const user = useAuth.getState().user
      if (user && user.locale !== next) {
        void apiClient
          .updateMe({ locale: next })
          .then((updated) => useAuth.getState().setUser(updated))
          .catch(() => undefined)
      }
    },
    [location.pathname, location.search, navigate],
  )
}
