import * as React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Frame,
  FolderOpen,
  Calculator,
  Layers,
  Settings,
  LifeBuoy,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Sparkles,
} from 'lucide-react'

import { Logo } from '@/components/ui'
import { cn, initials } from '@/lib/utils'
import { useLocale, useSwitchLocale } from '@/lib/locale'
import { useAuth } from '@/store/auth'
import type { Locale } from '@/lib/types'

interface NavItem {
  to: string
  labelKey: string
  icon: React.ReactNode
  end?: boolean
}

const groups: { key: string; items: NavItem[] }[] = [
  {
    key: 'overview',
    items: [{ to: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="size-[17px]" /> }],
  },
  {
    key: 'workspace',
    items: [
      { to: 'studio', labelKey: 'nav.studio', icon: <Frame className="size-[17px]" /> },
      { to: 'designs', labelKey: 'nav.designs', icon: <FolderOpen className="size-[17px]" /> },
    ],
  },
  {
    key: 'engineering',
    items: [
      { to: 'calculations', labelKey: 'nav.calculations', icon: <Calculator className="size-[17px]" /> },
      { to: 'library', labelKey: 'nav.library', icon: <Layers className="size-[17px]" /> },
    ],
  },
]

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const switchLocale = useSwitchLocale()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const base = `/${locale}/app`

  return (
    <aside
      className={cn(
        'fixed inset-y-0 start-0 z-30 flex flex-col bg-sidebar text-white/80 transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-white/10',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {collapsed ? (
          <Logo mark />
        ) : (
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="mt-0.5 h-0.5 w-7 rounded-full bg-accent" aria-hidden="true" />
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('common.collapse')}
          >
            <ChevronsLeft className="size-4 rtl:rotate-180" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        {groups.map((group) => (
          <div key={group.key} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {t(`nav.${group.key}`)}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={`${base}/${item.to}`}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-sidebar-active font-medium text-white'
                          : 'text-white/70 hover:bg-sidebar-hover hover:text-white',
                      )
                    }
                    title={collapsed ? t(item.labelKey) : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-accent" />
                        )}
                        <span className={cn('shrink-0', isActive ? 'text-white' : 'text-white/60')}>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 px-2.5 pb-3">
        {!collapsed && user && (
          <div className="mb-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-white/50">
              <Sparkles className="size-3" />
              {user.plan === 'pro' || user.role === 'admin' ? t('nav.planPro') : t('nav.planFree')}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  'h-full rounded-full',
                  user.plan === 'pro' || user.role === 'admin' ? 'w-full bg-success' : 'w-1/3 bg-accent',
                )}
              />
            </div>
          </div>
        )}

        <div
          className={cn(
            'flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5',
            collapsed && 'flex-col',
          )}
        >
          {(['ar', 'en'] as Locale[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => switchLocale(code)}
              className={cn(
                'h-7 flex-1 rounded-[6px] text-[11px] font-medium transition-colors',
                locale === code ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white',
                collapsed && 'w-8 flex-none',
              )}
              aria-pressed={locale === code}
            >
              {code === 'ar' ? 'العربية' : 'English'}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-0.5">
          <NavLink
            to={`${base}/settings`}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] text-white/60 transition-colors hover:bg-sidebar-hover hover:text-white',
              collapsed && 'justify-center px-0',
            )}
            title={t('nav.settings')}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && t('nav.settings')}
          </NavLink>
          <NavLink
            to={`/${locale}/welcome`}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] text-white/60 transition-colors hover:bg-sidebar-hover hover:text-white',
              collapsed && 'justify-center px-0',
            )}
            title={t('nav.help')}
          >
            <LifeBuoy className="size-4 shrink-0" />
            {!collapsed && t('nav.help')}
          </NavLink>
        </div>

        {user && (
          <div
            className={cn(
              'mt-2 flex items-center gap-2.5 border-t border-white/10 pt-2.5',
              collapsed && 'justify-center',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
              {initials(user.fullName) || 'TC'}
            </span>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-white">{user.fullName}</p>
                  <p className="truncate text-[10.5px] text-white/45">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={t('nav.signOut')}
                  title={t('nav.signOut')}
                >
                  <LogOut className="size-3.5 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="mx-auto mb-3 grid size-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={t('common.expand')}
        >
          <ChevronsRight className="size-4 rtl:rotate-180" />
        </button>
      )}
    </aside>
  )
}
