import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const BASE = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000/v1'

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('stoqly_token')
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem('stoqly_token', token)
  else await AsyncStorage.removeItem('stoqly_token')
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
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
