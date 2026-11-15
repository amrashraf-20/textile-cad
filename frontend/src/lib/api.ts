import type { AuthPayload, MeResponse, Settings } from './types'

const BASE = '/api/v1'

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let accessToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  if (accessToken) h.Authorization = `Bearer ${accessToken}`
  return h
}

async function raw(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...headers(init.body !== undefined), ...(init.headers ?? {}) },
  })
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? 'Request failed')
  }
  return data as T
}

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await raw('/auth/refresh', { method: 'POST' })
        if (!res.ok) return false
        const data = (await res.json()) as AuthPayload
        accessToken = data.accessToken
        return true
      } catch {
        return false
      } finally {
        setTimeout(() => {
          refreshPromise = null
        }, 0)
      }
    })()
  }
  return refreshPromise
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let res = await raw(path, init)
  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    const ok = await refreshSession()
    if (ok) {
      res = await raw(path, init)
    } else {
      accessToken = null
      window.dispatchEvent(new Event('tc:unauthorized'))
    }
  }
  return parse<T>(res)
}

export const apiClient = {
  bootstrap: async (): Promise<MeResponse | null> => {
    const ok = await refreshSession()
    if (!ok) return null
    try {
      return await api<MeResponse>('/auth/me', {}, false)
    } catch {
      return null
    }
  },
  login: (email: string, password: string) =>
    api<AuthPayload>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (input: { email: string; password: string; fullName: string; locale: string }) =>
    api<AuthPayload>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }, false),
  logoutAll: () => api<void>('/auth/logout-all', { method: 'POST' }),
  me: () => api<MeResponse>('/auth/me'),
  updateSettings: (settings: Settings) =>
    api<Settings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  updateMe: (input: { fullName?: string; locale?: string }) =>
    api<MeResponse['user']>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  forgotPassword: (email: string) =>
    api<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false),
  resetPassword: (token: string, password: string) =>
    api<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }, false),
}

export async function downloadWithAuth(path: string, filename: string) {
  let res = await raw(path, { method: 'GET' })
  if (res.status === 401) {
    const ok = await refreshSession()
    if (ok) res = await raw(path, { method: 'GET' })
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const err = (data as { error?: { message?: string } } | null)?.error
    throw new ApiError(res.status, 'download_failed', err?.message ?? 'Download failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export { refreshSession }
