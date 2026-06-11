import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuth } from '@/store/auth'
import { theme } from '@/theme'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AuthGuard() {
  const { user, loading, restore } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => { restore() }, [])

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) router.replace('/(auth)/login')
    if (user && inAuth)  router.replace('/(tabs)')
  }, [user, loading, segments])

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={theme.brand} size="large" />
      </View>
    )
  }
  return null
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <StatusBar style="light" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
