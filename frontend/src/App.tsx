import * as React from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { LocaleGate, Protected, RootRedirect } from '@/components/Guards'
import { PageLoader } from '@/components/ui'
import { useAuth } from '@/store/auth'
import { LoadingScreen } from '@/pages/Loading'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Designs from '@/pages/Designs'
import Studio from '@/pages/Studio'
import Calculations from '@/pages/Calculations'
import Library from '@/pages/Library'
import Settings from '@/pages/Settings'
import Share from '@/pages/Share'
import NotFound from '@/pages/NotFound'

let bootstrapped = false

function PublicOnly({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status)
  const { locale } = useParams()
  if (status === 'ready') return <Navigate to={`/${locale ?? 'ar'}/app/dashboard`} replace />
  return <>{children}</>
}

function LocaleHome() {
  const status = useAuth((s) => s.status)
  const { locale } = useParams()
  if (status === 'ready') return <Navigate to={`/${locale ?? 'ar'}/app/dashboard`} replace />
  if (status === 'anon') return <Navigate to={`/${locale ?? 'ar'}/login`} replace />
  return <PageLoader />
}

export default function App() {
  const status = useAuth((s) => s.status)
  const bootstrap = useAuth((s) => s.bootstrap)

  const [showSplash, setShowSplash] = React.useState(() => {
    try {
      return sessionStorage.getItem('tc_booted') !== '1'
    } catch {
      return true
    }
  })
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    if (bootstrapped) return
    bootstrapped = true
    void bootstrap()
  }, [bootstrap])

  // Progress creeps forward while the session check is in flight, then finishes.
  React.useEffect(() => {
    if (!showSplash) return
    const id = window.setInterval(() => {
      setProgress((value) => {
        const cap = status === 'loading' ? 88 : 100
        if (value >= cap) return value
        const step = value < 40 ? 7 : value < 70 ? 4 : value < 88 ? 2 : 4
        return Math.min(cap, value + step)
      })
    }, 85)
    return () => window.clearInterval(id)
  }, [showSplash, status])

  React.useEffect(() => {
    if (!showSplash) return
    if (status === 'loading' || progress < 100) return
    const id = window.setTimeout(() => {
      try {
        sessionStorage.setItem('tc_booted', '1')
      } catch {
        /* private mode — splash will simply show again */
      }
      setShowSplash(false)
    }, 420)
    return () => window.clearTimeout(id)
  }, [showSplash, status, progress])

  if (showSplash) {
    return <LoadingScreen progress={progress} ready={status !== 'loading'} />
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/share/:token" element={<Share />} />

      <Route path="/:locale" element={<LocaleGate />}>
        <Route index element={<LocaleHome />} />

        <Route
          path="login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="register"
          element={
            <PublicOnly>
              <Register />
            </PublicOnly>
          }
        />
        <Route
          path="forgot-password"
          element={
            <PublicOnly>
              <ForgotPassword />
            </PublicOnly>
          }
        />
        <Route
          path="reset-password"
          element={
            <PublicOnly>
              <ResetPassword />
            </PublicOnly>
          }
        />

        <Route path="welcome" element={<Onboarding />} />

        <Route element={<Protected />}>
          <Route path="app" element={<AppShell />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="designs" element={<Designs />} />
            <Route path="studio" element={<Studio />} />
            <Route path="studio/:id" element={<Studio />} />
            <Route path="calculations" element={<Calculations />} />
            <Route path="library" element={<Library />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
