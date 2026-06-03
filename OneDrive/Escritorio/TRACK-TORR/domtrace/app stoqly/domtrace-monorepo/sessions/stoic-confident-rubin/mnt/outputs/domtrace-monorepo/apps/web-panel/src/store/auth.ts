import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../lib/api'

interface User { id: string; name: string; email: string; assistantName: string }

interface AuthStore {
  user: User | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      login: async (email, password) => {
        const data = await api.post<{ user: User; tokens: { accessToken: string } }>(
          '/auth/login', { email, password }
        )
        localStorage.setItem('accessToken', data.tokens.accessToken)
        set({ user: data.user, accessToken: data.tokens.accessToken })
      },
      logout: () => {
        localStorage.removeItem('accessToken')
        set({ user: null, accessToken: null })
      },
    }),
    { name: 'stoqly-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) }
  )
)
