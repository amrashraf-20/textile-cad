import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Compass } from 'lucide-react'

import { Button, Card, Logo } from '@/components/ui'
import { AppFooter } from '@/components/AppShell'
import { normalizeLocale } from '@/lib/locale'

export default function NotFound() {
  const { t } = useTranslation()
  const { locale } = useParams()
  const safeLocale = normalizeLocale(locale)

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <header className="flex h-14 items-center border-b border-line bg-white px-4 sm:px-6">
        <Link to={`/${safeLocale}`}>
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-line bg-surface-muted text-muted">
            <Compass className="size-5" />
          </span>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">404</p>
          <h1 className="mt-1 text-[19px] font-semibold tracking-[-0.01em] text-ink">
            {t('errors.notFound')}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted">{t('errors.notFoundDesc')}</p>
          <Link to={`/${safeLocale}/app/dashboard`} className="mt-6 inline-block">
            <Button size="md">
              <ArrowLeft className="size-3.5 rtl:rotate-180" />
              {t('errors.goHome')}
            </Button>
          </Link>
        </Card>
      </main>

      <AppFooter />
    </div>
  )
}
