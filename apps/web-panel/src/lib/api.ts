const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem('st', token)
  else sessionStorage.removeItem('st')
}

function getToken(): string | null {
  // 1. sessionStorage (login actual)
  const st = sessionStorage.getItem('st')
  if (st) return st
  // 2. Fallback zustand persist (recarga de página)
  try {
    const stored = localStorage.getItem('stoqly-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      const t = parsed.state?.accessToken ?? null
      if (t) { sessionStorage.setItem('st', t); return t }
    }
  } catch {}
  return null
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const isAuthEndpoint = path.startsWith('/auth/')
  if (res.status === 401 && !isAuthEndpoint) {
    // Token caducado o inválido: limpiar sesión y mandar a login
    sessionStorage.removeItem('st')
    localStorage.removeItem('stoqly-auth')
    if (location.pathname !== '/login') {
      location.href = '/login'
    }
    throw new Error('Sesión caducada, vuelve a iniciar sesión')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json().then(d => d.data ?? d)
}

export const api = {
  get:    <T>(path: string) => req<T>(path),
  post:   <T>(path: