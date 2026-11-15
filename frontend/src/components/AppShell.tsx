import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { Logo } from './ui'
import { cn } from '@/lib/utils'

export function AppFooter({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-3 text-[11px] text-muted',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Logo mark className="[&>span:first-child]:size-5 [&_svg]:size-3.5" />
        <span>{t('common.appName')}</span>
        <span className="text-line-strong">·</span>
        <span>{t('footer.tagline')}</span>
      </div>
      <span>
        {t('footer.version')} 1.0.0
      </span>
    </footer>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1120,
  )

  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 900) setCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="min-h-screen bg-app">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'ps-[72px]' : 'ps-[260px]',
        )}
      >
        <Topbar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <main className="flex-1 px-4 py-5 sm:px-6">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  )
}
