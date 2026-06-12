import { create } from 'zustand'
import { api, setToken, getToken } from '../lib/api'

interface AuthState {
  user: { id: string; name: string; email: string; assistantName?: string } | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restore: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  login: async (email, password) => {
    const res = await api.post<any>('/auth/login', { email, password })
    await setToken(res.tokens.accessToken)
    set({ user: res.user, token: res.tokens.accessToken })
  },

  logout: async () => {
    await setToken(null)
    set({ user: null, token: null })
  },

  restore: async () => {
    try {
      const token = await getToken()
      if (!token) { set({ loading: false }); return }
      const profile = await api.get<any>('/profile')
      set({ user: profile.user, token, loading: false })
    } catch {
      await setToken(null)
      set({ user: null, token: null, loading: false })
    }
  },
}))
