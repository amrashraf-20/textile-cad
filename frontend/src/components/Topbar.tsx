import * as React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PanelLeft,
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  UserRound,
  LayoutDashboard,
  Frame,
  FolderOpen,
  Calculator,
  Layers,
  LifeBuoy,
} from 'lucide-react'

import { Badge } from '@/components/ui'
import { cn, initials } from '@/lib/utils'
import { useLocale } from '@/lib/locale'
import { useAuth } from '@/store/auth'

const titles: { match: string; key: string; icon: React.ReactNode }[] = [
  { match: '/app/dashboard', key: 'nav.dashboard', icon: <LayoutDashboard className="size-4" /> },
  { match: '/app/studio', key: 'nav.studio', icon: <Frame className="size-4" /> },
  { match: '/app/designs', key: 'nav.designs', icon: <FolderOpen className="size-4" /> },
  { match: '/app/calculations', key: 'nav.calculations', icon: <Calculator className="size-4" /> },
  { match: '/app/library', key: 'nav.library', icon: <Layers className="size-4" /> },
  { match: '/app/settings', key: 'nav.settings', icon: <Settings className="size-4" /> },
  { match: '/welcome', key: 'nav.help', icon: <LifeBuoy className="size-4" /> },
]

export function Topbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [notifOpen, setNotifOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  const current = titles.find((item) => location.pathname.includes(item.match)) ?? titles[0]

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    navigate(`/${locale}/app/designs${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''}`)
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white px-4">
      <button
        type="button"
        onClick={onToggle}
        className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
        aria-label={collapsed ? t('common.expand') : t('common.collapse')}
      >
        <PanelLeft className="size-4 rtl:rotate-180" />
      </button>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted">{current.icon}</span>
        <h1 className="truncate text-[13.5px] font-semibold text-ink">{t(current.key)}</h1>
      </div>

      <div className="ms-auto flex items-center gap-1.5">
        <form onSubmit={submitSearch} className="relative hidden md:block">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            className="h-8 w-52 rounded-lg border border-line bg-surface-muted ps-8 pe-3 text-[12px] text-ink placeholder:text-muted/80 focus:border-accent/50 focus:bg-white focus:outline-none lg:w-64"
            aria-label={t('common.search')}
          />
        </form>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v)
              setMenuOpen(false)
            }}
            className="relative grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label={t('common.notifications')}
          >
            <Bell className="size-4" />
            <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-accent ring-2 ring-white" />
          </button>
          {notifOpen && (
            <div className="absolute end-0 top-10 w-64 rounded-[10px] border border-line bg-white p-1 shadow-[0_12px_32px_rgba(16,24,40,.12)] animate-fade-in">
              <div className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t('common.notifications')}
              </div>
              <p className="px-2.5 pb-3 pt-1 text-[12px] text-muted">{t('common.noNotifications')}</p>
            </div>
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v)
              setNotifOpen(false)
            }}
            className="flex items-center gap-2 rounded-lg py-1 pe-1 ps-1 transition-colors hover:bg-surface-muted"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="grid size-8 place-items-center rounded-full bg-sidebar text-[11px] font-semibold text-white">
              {initials(user?.fullName ?? '') || 'TC'}
            </span>
            <span className="hidden text-start leading-tight sm:block">
              <span className="block max-w-[140px] truncate text-[12px] font-medium text-ink">
                {user?.fullName}
              </span>
              <span className="block text-[10.5px] text-muted">
                {user?.role === 'admin'
                  ? t('common.admin')
                  : user?.plan === 'pro'
                    ? t('common.pro')
                    : t('common.free')}
              </span>
            </span>
            <ChevronDown className="hidden size-3.5 text-muted sm:block" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute end-0 top-11 w-56 overflow-hidden rounded-[10px] border border-line bg-white shadow-[0_12px_32px_rgba(16,24,40,.12)] animate-fade-in"
            >
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-[12.5px] font-medium text-ink">{user?.fullName}</p>
                <p className="truncate text-[11px] text-muted">{user?.email}</p>
                <div className="mt-1.5">
                  <Badge tone={user?.plan === 'pro' || user?.role === 'admin' ? 'accent' : 'neutral'}>
                    {user?.role === 'admin'
                      ? t('common.admin')
                      : user?.plan === 'pro'
                        ? t('nav.planPro')
                        : t('nav.planFree')}
                  </Badge>
                </div>
              </div>
              <div className="p-1">
                <Link
                  to={`/${locale}/app/settings`}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-ink-soft hover:bg-surface-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  <UserRound className="size-3.5" />
                  {t('common.profile')}
                </Link>
                <Link
                  to={`/${locale}/app/settings`}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-ink-soft hover:bg-surface-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="size-3.5" />
                  {t('common.settings')}
                </Link>
              </div>
              <div className="border-t border-line p-1">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-[12.5px] text-accent hover:bg-accent-soft',
                  )}
                >
                  <LogOut className="size-3.5 rtl:rotate-180" />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
