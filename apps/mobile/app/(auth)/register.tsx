import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native'
import { Link } from 'expo-router'
import { api, setToken } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { theme } from '@/theme'

export default function RegisterScreen() {
  const { login } = useAuth()

  const [step, setStep]         = useState<'account' | 'name' | 'done'>('account')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const createAccount = async () => {
    if (!email || !password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres'); return
    }
    setLoading(true); setError('')
    try {
      const res = await api.post<any>('/auth/register', { email, password, name: name || email.split('@')[0] })
      await setToken(res.tokens.accessToken)
      setStep('name')
    } catch (e: any) {
      if (e.message?.includes('ya registrado')) {
        setError('Este email ya tiene cuenta. Entra desde el login.')
      } else { setError(e.message) }
    } finally { setLoading(false) }
  }

  const saveName = async () => {
    if (!name) return
    setLoading(true)
    try {
      await api.put('/profile', { name })
      setStep('done')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const finish = async () => {
    setLoading(true)
    try {
      await login(email, password)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const steps: Array<'account' | 'name' | 'done'> = ['account', 'name', 'done']

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>

          <View style={styles.logoWrap}>
            <Text style={styles.logo}>Stoqly</Text>
            <Text style={styles.tagline}>Tu despensa inteligente</Text>
          </View>

          {/* Step indicators */}
          <View style={styles.dots}>
            {steps.map(s => (
              <View
                key={s}
                style={[styles.dot, { backgroundColor: step === s ? theme.brand : theme.border }]}
              />
            ))}
          </View>

          {/* Paso 1: cuenta */}
          {step === 'account' && (
            <View style={styles.form}>
              <Text style={styles.stepTitle}>Crea tu cuenta gratuita</Text>

              <View>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@email.com" placeholderTextColor={theme.muted}
                  keyboardType="email-address" autoCapitalize="none"
                  value={email} onChangeText={setEmail} returnKeyType="next"
                />
              </View>
              <View>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 8 caracteres" placeholderTextColor={theme.muted}
                  secureTextEntry value={password} onChangeText={setPassword}
                  returnKeyType="done" onSubmitEditing={createAccount}
                />
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                onPress={createAccount} disabled={!email || !password || loading}
                style={[styles.btn, { opacity: !email || !password || loading ? 0.5 : 1 }]}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Empezar →</Text>}
              </TouchableOpacity>
              <View style={styles.linkRow}>
                <Text style={styles.linkMuted}>¿Ya tienes cuenta? </Text>
                <Link href="/(auth)/login"><Text style={styles.linkBrand}>Entrar →</Text></Link>
              </View>
            </View>
          )}

          {/* Paso 2: nombre */}
          {step === 'name' && (
            <View style={styles.form}>
              <View style={styles.chatBubble}>
                <Text style={styles.chatLabel}>✦ Stoqly</Text>
                <Text style={styles.chatText}>Hola, soy Stoqly. Voy a ayudarte a que nunca te falte nada en casa. ¿Cómo te llamo?</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Tu nombre" placeholderTextColor={theme.muted}
                autoFocus value={name} onChangeText={setName}
                returnKeyType="done" onSubmitEditing={saveName}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                onPress={saveName} disabled={!name || loading}
                style={[styles.btn, { opacity: !name || loading ? 0.5 : 1 }]}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Siguiente →</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Paso 3: listo */}
          {step === 'done' && (
            <View style={[styles.form, { alignItems: 'center' }]}>
              <View style={[styles.chatBubble, { width: '100%' }]}>
                <Text style={styles.chatLabel}>✦ Stoqly</Text>
                <Text style={styles.chatText}>¡Perfecto, {name}! Ya sé lo suficiente para empezar. Cuando llegues a casa con algo, solo dímelo y me encargo.</Text>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                onPress={finish} disabled={loading}
                style={[styles.btn, { opacity: loading ? 0.5 : 1, width: '100%' }]}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>¡Vamos a la despensa! →</Text>}
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: theme.bg },
  inner:     { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap:  { alignItems: 'center', marginBottom: 40 },
  logo:      { fontSize: 36, fontWeight: '900', color: theme.brand, letterSpacing: 6 },
  tagline:   { color: theme.muted, fontSize: 14, marginTop: 4 },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  form:      { gap: 16 },
  stepTitle: { color: theme.text, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  label:     {
    color: theme.muted, fontSize: 12, fontWeight: '500',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  input:      {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: theme.text, fontSize: 16,
  },
  errorText:  { color: theme.danger, fontSize: 14 },
  btn:        {
    backgroundColor: theme.brand, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:    { flexDirection: 'row', justifyContent: 'center' },
  linkMuted:  { color: theme.muted, fontSize: 14 },
  linkBrand:  { color: theme.brand, fontSize: 14, fontWeight: '600' },
  chatBubble: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  chatLabel: { color: theme.brand, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  chatText:  { color: theme.text, fontSize: 14, lineHeight: 22 },
})
