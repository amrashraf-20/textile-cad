import { create } from 'zustand'
import { apiClient, setAccessToken } from '@/lib/api'
import type { AuthPayload, MeResponse, Settings, User } from '@/lib/types'

interface AuthState {
  user: User | null
  settings: Settings | null
  status: 'loading' | 'ready' | 'anon'
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; fullName: string; locale: string }) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  setSettings: (settings: Settings) => void
}

function applyAuth(payload: AuthPayload) {
  setAccessToken(payload.accessToken)
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  settings: null,
  status: 'loading',

  bootstrap: async () => {
    const me = await apiClient.bootstrap()
    if (!me) {
      set({ user: null, settings: null, status: 'anon' })
      return
    }
    set({ user: me.user, settings: me.settings, status: 'ready' })
  },

  login: async (email, password) => {
    const payload = await apiClient.login(email, password)
    applyAuth(payload)
    const me = await apiClient.me()
    set({ user: me.user, settings: me.settings, status: 'ready' })
  },

  register: async (input) => {
    const payload = await apiClient.register(input)
    applyAuth(payload)
    const me = await apiClient.me()
    set({ user: me.user, settings: me.settings, status: 'ready' })
  },

  logout: async () => {
    try {
      await apiClient.logout()
    } finally {
      setAccessToken(null)
      set({ user: null, settings: null, status: 'anon' })
    }
  },

  setUser: (user) => {
    const prev = get().user
    set({ user: { ...prev, ...user } })
  },

  setSettings: (settings) => set({ settings }),
}))

// A failed refresh in the API client means the session is gone.
if (typeof window !== 'undefined') {
  window.addEventListener('tc:unauthorized', () => {
    setAccessToken(null)
    useAuth.setState({ user: null, settings: null, status: 'anon' })
  })
}

export async function loadMe() {
  const me: MeResponse = await apiClient.me()
  useAuth.setState({ user: me.user, settings: me.settings, status: 'ready' })
  return me
}
