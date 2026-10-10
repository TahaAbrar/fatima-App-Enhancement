const AUTH_KEY = 'fuelledger_auth'

export type AuthUser = {
  id: string | number
  username: string
  role: 'Administrator' | 'Accountant' | 'User' | 'Customer' | 'Unit' | string
  accid?: number
  name?: string
}

export type AuthSession = {
  token: string
  user: AuthUser
  redirectTo: string
}

function readStore(): string | null {
  try {
    const fromLocal = localStorage.getItem(AUTH_KEY)
    if (fromLocal) return fromLocal
    const fromSession = sessionStorage.getItem(AUTH_KEY)
    if (fromSession) {
      localStorage.setItem(AUTH_KEY, fromSession)
      sessionStorage.removeItem(AUTH_KEY)
      return fromSession
    }
    return null
  } catch {
    return null
  }
}

export function getSession(): AuthSession | null {
  try {
    const raw = readStore()
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getSession()?.token)
}

export function getUserRole(): string | null {
  return getSession()?.user?.role ?? null
}

export function setSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_KEY)
  try {
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

/** @deprecated use setSession */
export function setAuthenticated(value: boolean): void {
  if (!value) clearSession()
}

export function homePathForRole(role: string): string {
  const r = role.toLowerCase()
  if (r === 'administrator' || r === 'admin') return '/dashboard'
  if (r === 'accountant') return '/accountant/dashboard'
  if (r === 'customer') return '/customer/dashboard'
  if (r === 'unit') return '/unit/dashboard'
  return '/login'
}

const API_BASE = import.meta.env.VITE_API_URL || ''

export async function apiLogin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.message || 'Login failed')
  }
  return data as {
    ok: true
    token: string
    redirectTo: string
    user: AuthUser
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // ignore network errors on logout
  } finally {
    clearSession()
  }
}
