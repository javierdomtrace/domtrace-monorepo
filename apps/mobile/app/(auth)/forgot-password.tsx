import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { api } from '@/lib/api'
import { theme } from '@/theme'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true); setError('')
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo enviar el correo')
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
            <Text style={styles.tagline}>Recuperar contraseña</Text>
          </View>

          {sent ? (
            /* Confirmación */
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>✉️ Revisa tu correo</Text>
              <Text style={styles.successText}>
                Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña. Puede tardar unos minutos.
              </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.btn}>
                <Text style={styles.btnText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Formulario */
            <View style={styles.form}>
              <Text style={styles.instructions}>
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </Text>

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
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!email.trim() || loading}
                style={[styles.btn, { opacity: !email.trim() || loading ? 0.5 : 1 }]}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Enviar enlace</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Back to login */}
          {!sent && (
            <View style={styles.linkRow}>
              <Link href="/(auth)/login">
                <Text style={styles.linkMuted}>← Volver al inicio de sesión</Text>
              </Link>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: theme.bg },
  inner:         { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap:      { alignItems: 'center', marginBottom: 48 },
  logo:          { fontSize: 36, fontWeight: '900', color: theme.brand, letterSpacing: 6 },
  tagline:       { color: theme.muted, fontSize: 14, marginTop: 4 },
  form:          { gap: 16 },
  instructions:  { color: theme.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  label:         {
    color: theme.muted, fontSize: 12, fontWeight: '500',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: theme.text, fontSize: 16,
  },
  errorBox:      {
    backgroundColor: 'rgba(226,75,74,0.1)', borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.3)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  errorText:     { color: theme.danger, fontSize: 14 },
  successBox:    { gap: 16, alignItems: 'center' },
  successTitle:  { color: theme.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successText:   { color: theme.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  btn:           {
    backgroundColor: theme.brand, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8, width: '100%',
  },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:       { alignItems: 'center', marginTop: 28 },
  linkMuted:     { color: theme.muted, fontSize: 14 },
})
