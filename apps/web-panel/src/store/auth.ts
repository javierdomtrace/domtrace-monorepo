import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, setToken, setRefreshToken } from '../lib/api'

export type Tier = 'FREE' | 'HOGAR' | 'EXPERTO' | 'ENTERPRISE'

export interface User {
  id: string
  name: string
  email: string
  assistantName: string
  subscriptionTier: Tier
  activeHouseholdId: string | null
}

interface AuthStore {
  user: User | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (patch: Partial<User>) => void
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      login: async (email, password) => {
        const data = await api.post<{ user: User; tokens: { accessToken: string; refreshToken?: string } }>(
          '/auth/login', { email, password }
        )
        setToken(data.tokens.accessToken)
        setRefreshToken(data.tokens.refreshToken ?? null)
        set({ user: data.user, accessToken: data.tokens.accessToken })
      },
      logout: () => {
        setToken(null)
        setRefreshToken(null)
        set({ user: null, accessToken: null })
      },
      updateUser: (patch) => set(s => ({ user: s.user ? { ...s.user, ...patch } : null })),
    }),
    { name: 'stoqly-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) }
  )
)
