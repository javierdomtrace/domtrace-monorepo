import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/store/auth'
import { theme } from '@/theme'

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true); setError('')
    try {
      await login(email, password)
    } catch (e: any) {
      setError(e.message ?? 'Error al entrar')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>Stoqly</Text>
            <Text style={styles.tagline}>Tu asistente de hogar</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                placeholderTextColor={theme.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
              />
            </View>

            <View>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.muted}
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleLogin}
              disabled={!email || !password || loading}
              style={[styles.btn, { opacity: !email || !password || loading ? 0.5 : 1 }]}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Entrar</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkMuted}>¿Sin cuenta? </Text>
            <Link href="/(auth)/register">
              <Text style={styles.linkBrand}>Créala aquí →</Text>
            </Link>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: theme.bg },
  inner:    { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logo:     { fontSize: 36, fontWeight: '900', color: theme.brand, letterSpacing: 6 },
  tagline:  { color: theme.muted, fontSize: 14, marginTop: 4 },
  form:     { gap: 16 },
  label:    {
    color: theme.muted, fontSize: 12, fontWeight: '500',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: theme.text, fontSize: 16,
  },
  errorBox:  {
    backgroundColor: 'rgba(226,75,74,0.1)', borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.3)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  errorText: { color: theme.danger, fontSize: 14 },
  btn:       {
    backgroundColor: theme.brand, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  linkMuted: { color: theme.muted, fontSize: 14 },
  linkBrand: { color: theme.brand, fontSize: 14, fontWeight: '600' },
})
