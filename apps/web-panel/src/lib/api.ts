const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem('st', token)
  else sessionStorage.removeItem('st')
}

// El refresh token vive 30 días, así que se guarda en localStorage (sobrevive
// a recargas y cierres de pestaña, igual que la sesión persistida de zustand).
export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem('st_refresh', token)
  else localStorage.removeItem('st_refresh')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('st_refresh')
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

function clearSession() {
  sessionStorage.removeItem('st')
  localStorage.removeItem('stoqly-auth')
  localStorage.removeItem('st_refresh')
}

// En producción el access token dura solo 15 minutos (en dev 24h). Cuando una
// petición devuelve 401 intentamos renovarlo con el refresh token (30 días)
// antes de echar al usuario a /login, para que una sesión larga (p. ej.
// rellenando el formulario de "Añadir producto") no se rompa a media tarea.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async res => {
        if (!res.ok) return null
        const json = await res.json().catch(() => null)
        const tokens = json?.data?.tokens
        if (!tokens?.accessToken) return null
        setToken(tokens.accessToken)
        if (tokens.refreshToken) setRefreshToken(tokens.refreshToken)
        // Mantener sincronizado el accessToken persistido por zustand
        try {
          const stored = JSON.parse(localStorage.getItem('stoqly-auth') ?? 'null')
          if (stored?.state) {
            stored.state.accessToken = tokens.accessToken
            localStorage.setItem('stoqly-auth', JSON.stringify(stored))
          }
        } catch {}
        return tokens.accessToken as string
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function req<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
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
    if (!isRetry) {
      const newToken = await refreshAccessToken()
      if (newToken) return req<T>(path, init, true)
    }
    // Token caducado/inválido y no se pudo renovar: limpiar sesión y mandar a login
    clearSession()
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
  post:   <T>(path: string, body: unknown) => req<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => req<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown) => req<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => req<T>(path, { method: 'DELETE' }),
}
