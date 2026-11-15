import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'
import type { Locale } from './types'

export const SUPPORTED_LOCALES: Locale[] = ['ar', 'en']

export function detectLocale(): Locale {
  const stored = localStorage.getItem('tc_locale')
  if (stored === 'ar' || stored === 'en') return stored
  const nav = navigator.language.toLowerCase()
  return nav.startsWith('ar') ? 'ar' : 'en'
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  localStorage.setItem('tc_locale', locale)
}

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: detectLocale(),
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLocale((i18n.language as Locale) ?? 'ar')

i18n.on('languageChanged', (lng) => {
  applyDocumentLocale(lng === 'en' ? 'en' : 'ar')
})

export default i18n
