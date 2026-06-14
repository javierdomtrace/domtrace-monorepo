import { useState, useEffect, type ReactNode } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, Switch, Vibration, Linking } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/store/auth'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { useA11y, FONT_SCALE, type FontSize as A11yFontSize, type A11yMode } from '@/store/accessibility'
import { useA11yTheme } from '@/lib/a11y'

// ── Constantes (mismas que el panel web) ──────────────────────────────
const ALLERGEN_LABELS: Record<string, string> = {
  GLUTEN: 'Gluten', LACTOSA: 'Lactosa', FRUTOS_SECOS: 'Frutos secos',
  HUEVO: 'Huevo', MARISCO: 'Marisco', SOY: 'Soja',
  APIO: 'Apio', MOSTAZA: 'Mostaza', SESAMO: 'Sésamo', SULFITOS: 'Sulfitos',
}

const ACCESSIBILITY_OPTS = [
  { key: 'VOICE', label: '🔊 Voz' },
  { key: 'VIBRATION', label: '📳 Vibración' },
  { key: 'SILENT', label: '🔔 Silencioso' },
  { key: 'COMBINED', label: '♿ Combinado' },
]

const VOICE_SPEED_OPTS = [
  { key: 'SLOW', label: 'Lenta' },
  { key: 'NORMAL', label: 'Normal' },
  { key: 'FAST', label: 'Rápida' },
]

const TEXT_SIZE_OPTS = [
  { key: 'NORMAL', label: 'Normal' },
  { key: 'LARGE', label: 'Grande' },
  { key: 'XLARGE', label: 'Muy grande' },
]

// Conversión entre el formato del perfil (API) y el del store global de accesibilidad
const FS_API_TO_STORE: Record<string, A11yFontSize> = { NORMAL: 'normal', LARGE: 'large', XLARGE: 'xlarge' }
const FS_STORE_TO_API: Record<A11yFontSize, string> = { normal: 'NORMAL', large: 'LARGE', xlarge: 'XLARGE' }

// Perfiles rápidos de discapacidad — mismos 4 perfiles que el panel web
const A11Y_PROFILES: { key: A11yMode; icon: string; label: string; desc: string }[] = [
  { key: 'visual',    icon: '👁️', label: 'Visión reducida',    desc: 'Alto contraste + texto muy grande' },
  { key: 'motor',     icon: '✋', label: 'Movilidad reducida',  desc: 'Animaciones reducidas + texto grande' },
  { key: 'cognitive', icon: '🧠', label: 'Cognitiva',           desc: 'Interfaz simplificada + texto grande' },
  { key: 'deaf',      icon: '🔊', label: 'Audición',            desc: 'Énfasis visual en alertas' },
]

// Patrones de vibración (igual que en el panel web)
const VIBRATION_PATTERNS: Record<string, number[]> = {
  URGENT: [100, 50, 100, 50, 100, 100, 300],
  ALERT: [100, 50, 100],
  CONFIRM: [50],
  ERROR: [300, 100, 300],
  STOQLY: [50, 30, 50, 30, 50],
  BABY: [80, 30, 80, 30, 80, 30, 80],
}

const VIBRATION_OPTS = [
  { key: 'URGENT', icon: '🚨', label: 'Alerta urgente', desc: '3 cortos + 1 largo' },
  { key: 'ALERT', icon: '⚠️', label: 'Alerta normal', desc: '2 pulsos cortos' },
  { key: 'CONFIRM', icon: '✅', label: 'Confirmación', desc: '1 pulso suave' },
  { key: 'ERROR', icon: '❌', label: 'Error', desc: '2 pulsos largos' },
  { key: 'STOQLY', icon: '✦', label: 'Stoqly hablando', desc: '3 pulsos suaves' },
  { key: 'BABY', icon: '👶', label: 'Alerta bebé', desc: '4 pulsos rápidos (máxima atención)' },
]

// URL del panel web para gestión de planes/suscripción (no disponible en la app)
const PLANS_URL = 'https://app.stoqlyhome.com/plans'

const SUPERMARKETS = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'El Corte Inglés', 'Alcampo', 'Dia', 'Consum', 'Eroski', 'Otro']

const CATEGORIAS = [
  { id: 'ALIMENTACION', icon: '🥫', label: 'Alimentación', desc: 'Despensa, nevera y congelador. Siempre activa.', locked: true, tier: 'Free' },
  { id: 'BODEGA', icon: '🍷', label: 'Bodega y vinos', desc: 'Control de vinos con ventana óptima de consumo y sugerencias de maridaje.', locked: false, tier: 'Free' },
  { id: 'COSMETICOS', icon: '🧴', label: 'Cosméticos y belleza', desc: 'Control de PAO para cremas, sérum y maquillaje.', locked: false, tier: 'Hogar' },
  { id: 'MEDICAMENTOS', icon: '💊', label: 'Medicamentos', desc: 'Avisos de toma, control de stock y reciclaje SIGRE en farmacia.', locked: false, tier: 'Hogar' },
  { id: 'LIMPIEZA', icon: '🧹', label: 'Productos de limpieza', desc: 'Control de caducidad y alertas de seguridad si hay bebés en casa.', locked: false, tier: 'Free' },
  { id: 'BEBES', icon: '👶', label: 'Bebés y lactantes', desc: 'Tomas, introducción de sólidos, medicamentos pediátricos y alertas de máxima prioridad.', locked: false, tier: 'Hogar' },
]

const TIER_COLORS: Record<string, string> = { Free: '#1D9E75', Hogar: '#EF9F27', Pro: '#7F77DD' }

const ACTIVIDAD_OPTS = [
  { key: 'SEDENTARIO', label: 'Sedentario', desc: 'Trabajo de oficina, sin ejercicio' },
  { key: 'LIGERO', label: 'Ligero', desc: 'Ejercicio 1-2 días/semana' },
  { key: 'MODERADO', label: 'Moderado', desc: 'Ejercicio 3-5 días/semana' },
  { key: 'ACTIVO', label: 'Activo', desc: 'Ejercicio intenso 6-7 días' },
  { key: 'MUY_ACTIVO', label: 'Muy activo', desc: 'Trabajo físico + entrenamiento' },
]

const OBJETIVO_OPTS = [
  { key: 'PERDER_PESO', label: '⬇️ Perder peso', desc: 'Déficit de ~400 kcal/día' },
  { key: 'MANTENER', label: '⚖️ Mantenimiento', desc: 'Mantener el peso actual' },
  { key: 'GANAR_MUSCULO', label: '💪 Ganar masa muscular', desc: 'Superávit de ~300 kcal + más proteína' },
  { key: 'DIETA_ESPECIFICA', label: '🥗 Dieta específica', desc: 'Mediterránea, cetogénica, etc.' },
]

const DEPORTE_NIVEL_OPTS = [
  { key: 'PRINCIPIANTE', label: '🌱 Principiante', desc: 'Empezando o menos de 1 año' },
  { key: 'INTERMEDIO', label: '🔥 Intermedio', desc: '1-3 años de práctica regular' },
  { key: 'AVANZADO', label: '⚡ Avanzado', desc: 'Más de 3 años, alta intensidad' },
  { key: 'COMPETICION', label: '🏆 Competición', desc: 'Entrenas para competir' },
]

function calcKcal(peso: number, altura: number, edad: number, actividad: string, objetivo: string) {
  const tmb = 10 * peso + 6.25 * altura - 5 * edad + 5
  const f: Record<string, number> = { SEDENTARIO: 1.2, LIGERO: 1.375, MODERADO: 1.55, ACTIVO: 1.725, MUY_ACTIVO: 1.9 }
  let kcal = Math.round(tmb * (f[actividad] ?? 1.55))
  let prot = Math.round(peso * 1.6)
  if (objetivo === 'PERDER_PESO') kcal -= 400
  if (objetivo === 'GANAR_MUSCULO') { kcal += 300; prot = Math.round(peso * 2.0) }
  return { kcal, prot }
}

// ── Componentes de UI reutilizables ───────────────────────────────────
// Aplican el tamaño de texto y el alto contraste del store global de
// accesibilidad, asi que toda la pantalla de Ajustes se adapta al instante.
function Section({ title, children }: { title: string; children: ReactNode }) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <View style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[styles.sectionTitle, { color: t.text, fontSize: scale(16) }]}>{title}</Text>
      {children}
    </View>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  const { theme: t, scale } = useA11yTheme()
  return <Text style={[styles.fieldLabel, { color: t.muted, fontSize: scale(12) }]}>{children}</Text>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  )
}

function Input({ value, onChangeText, editing, placeholder, keyboardType, multiline }: {
  value: string; onChangeText: (v: string) => void; editing: boolean
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'; multiline?: boolean
}) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editing}
      placeholder={placeholder}
      placeholderTextColor={t.muted}
      keyboardType={keyboardType ?? 'default'}
      multiline={multiline}
      style={[
        styles.input,
        { backgroundColor: t.bg, borderColor: t.border, color: t.text, fontSize: scale(14) },
        !editing && styles.inputDisabled,
        multiline && { minHeight: 70, textAlignVertical: 'top' },
      ]}
    />
  )
}

function Pill({ label, active, onPress, disabled, color }: {
  label: string; active: boolean; onPress: () => void; disabled?: boolean; color?: string
}) {
  const { theme: t, scale } = useA11yTheme()
  const c = color ?? t.brand
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[
      styles.pill,
      { borderColor: t.border, backgroundColor: t.bg },
      active && { borderColor: c, backgroundColor: c + '22' },
    ]}>
      <Text style={[styles.pillText, { color: t.muted, fontSize: scale(13) }, active && { color: c, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  )
}

function OptionCard({ label, desc, active, onPress, disabled }: {
  label: string; desc?: string; active: boolean; onPress: () => void; disabled?: boolean
}) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[
      styles.optionCard,
      { borderColor: t.border, backgroundColor: t.bg },
      active && { borderColor: t.brand, backgroundColor: 'rgba(29,158,117,0.1)' },
    ]}>
      <Text style={[styles.optionLabel, { color: t.text, fontSize: scale(14) }, active && { color: t.brand }]}>{label}</Text>
      {desc ? <Text style={[styles.optionDesc, { color: t.muted, fontSize: scale(12) }]}>{desc}</Text> : null}
    </TouchableOpacity>
  )
}

function ToggleRow({ label, value, onValueChange, disabled }: {
  label: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean
}) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: t.text, fontSize: scale(14) }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled}
        trackColor={{ false: t.border, true: t.brand }} thumbColor="#fff" />
    </View>
  )
}

function CollapsedAdd({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <TouchableOpacity onPress={onPress} style={[styles.collapsedAdd, { borderColor: t.border }]}>
      <Text style={[styles.collapsedAddText, { color: t.brand, fontSize: scale(13) }]}>＋ {label}</Text>
    </TouchableOpacity>
  )
}

// ── Pantalla principal ─────────────────────────────────────────────────
export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  // Mi cuenta
  const [userName, setUserName] = useState('')
  const [codigoPostal, setCodigoPostal] = useState('')

  // Objetivo nutricional (opcional)
  const [showNutrition, setShowNutrition] = useState(false)
  const [pesoKg, setPesoKg] = useState('')
  const [alturaCm, setAlturaCm] = useState('')
  const [edadAnos, setEdadAnos] = useState('')
  const [nivelActividad, setNivelActividad] = useState('MODERADO')
  const [objetivoNutricional, setObjetivoNutricional] = useState('MANTENER')

  // Actividad física (opcional)
  const [showSport, setShowSport] = useState(false)
  const [deporte, setDeporte] = useState('')
  const [deporteNivel, setDeporteNivel] = useState('')
  const [deporteDiasSemana, setDeporteDiasSemana] = useState('')

  // Mi Stoqly
  const [assistantName, setAssistantName] = useState('')
  const [accessibilityMode, setAccessibilityMode] = useState('VOICE')
  const [voiceSpeed, setVoiceSpeed] = useState('NORMAL')
  const [humorEnabled, setHumorEnabled] = useState(true)

  // Mi hogar
  const [householdName, setHouseholdName] = useState('')
  const [supermarket, setSupermarket] = useState('')
  const [dirNombre, setDirNombre] = useState('')
  const [dirTelefono, setDirTelefono] = useState('')
  const [dirCalle, setDirCalle] = useState('')
  const [dirPiso, setDirPiso] = useState('')
  const [dirCP, setDirCP] = useState('')
  const [dirCiudad, setDirCiudad] = useState('')

  // Zonas de despensa
  const [editingZone, setEditingZone] = useState<{ id: string; name: string; icon: string } | null>(null)
  const [showAddZone, setShowAddZone] = useState(false)
  const [newZoneIcon, setNewZoneIcon] = useState('📦')
  const [newZoneName, setNewZoneName] = useState('')

  // Personas en casa
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')

  // Categorías activas
  const [categoriasActivas, setCategoriasActivas] = useState<string[]>(['ALIMENTACION'])

  // Alergias
  const [allergens, setAllergens] = useState<string[]>([])
  const [alergiasPersonalizadas, setAlergiasPersonalizadas] = useState<string[]>([])
  const [newAllergen, setNewAllergen] = useState('')

  // Accesibilidad — el store global aplica los cambios al instante en toda la app
  const [textSize, setTextSize] = useState('NORMAL')
  const [highContrast, setHighContrast] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const a11y = useA11y()
  const a11yTheme = useA11yTheme()

  // Cambia el tamano de texto: actualiza el formulario y aplica el cambio ya mismo
  const onSetTextSize = (key: string) => {
    setTextSize(key)
    a11y.setFontSize(FS_API_TO_STORE[key] ?? 'normal')
  }
  // Alterna alto contraste: actualiza el formulario y aplica el cambio ya mismo
  const onSetHighContrast = (v: boolean) => {
    setHighContrast(v)
    if (a11y.highContrast !== v) a11y.toggleHighContrast()
  }
  // Alterna reducir animaciones: actualiza el formulario y aplica el cambio ya mismo
  const onSetReduceMotion = (v: boolean) => {
    setReduceMotion(v)
    if (a11y.reducedMotion !== v) a11y.toggleReducedMotion()
  }
  // Selecciona un perfil rapido de discapacidad (aplica varios ajustes a la vez)
  const onSetA11yProfile = (mode: A11yMode) => {
    const next: A11yMode = a11y.activeMode === mode ? 'none' : mode
    a11y.setMode(next)
    const s = useA11y.getState()
    setHighContrast(s.highContrast)
    setTextSize(FS_STORE_TO_API[s.fontSize])
    setReduceMotion(s.reducedMotion)
  }

  // Mis domicilios
  const [showAddHousehold, setShowAddHousehold] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [householdMsg, setHouseholdMsg] = useState('')

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<any>('/profile'),
  })

  const tier = profile?.user?.subscriptionTier ?? 'FREE'

  const { data: zones } = useQuery({
    queryKey: ['pantryZones'],
    queryFn: () => api.get<any[]>('/pantry/zones'),
  })

  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.get<any[]>('/households'),
    enabled: tier !== 'FREE',
  })

  // Rellenar el formulario cuando llega el perfil
  useEffect(() => {
    if (!profile) return
    const u = profile.user ?? {}
    const h = profile.household ?? null

    setUserName(u.name ?? '')
    setCodigoPostal(u.codigoPostal ?? '')

    setAssistantName(u.assistantName ?? 'Stoqly')
    setAccessibilityMode(u.accessibilityMode ?? 'VOICE')
    setVoiceSpeed(u.voiceSpeed ?? 'NORMAL')
    setHumorEnabled(u.humorEnabled ?? true)

    setCategoriasActivas(u.categoriasActivas?.length ? u.categoriasActivas : ['ALIMENTACION'])
    setAllergens(u.allergens ?? [])
    setAlergiasPersonalizadas(u.alergiasPersonalizadas ?? [])

    setTextSize(u.textSize ?? 'NORMAL')
    setHighContrast(u.highContrast ?? false)
    setReduceMotion(u.reduceMotion ?? false)

    // Primera vez en este dispositivo: si el store local de accesibilidad sigue
    // en sus valores por defecto, aplicamos las preferencias guardadas en el
    // perfil para que la app se adapte tambien aqui.
    const a11yState = useA11y.getState()
    const a11yIsDefault = a11yState.activeMode === 'none' && a11yState.fontSize === 'normal'
      && !a11yState.highContrast && !a11yState.reducedMotion
    if (a11yIsDefault) {
      if (u.highContrast) a11yState.toggleHighContrast()
      if (u.reduceMotion) a11yState.toggleReducedMotion()
      const mapped = FS_API_TO_STORE[u.textSize ?? 'NORMAL']
      if (mapped && mapped !== 'normal') a11yState.setFontSize(mapped)
    }

    if (u.pesoKg || u.alturaCm || u.edadAnos) {
      setShowNutrition(true)
      setPesoKg(u.pesoKg != null ? String(u.pesoKg) : '')
      setAlturaCm(u.alturaCm != null ? String(u.alturaCm) : '')
      setEdadAnos(u.edadAnos != null ? String(u.edadAnos) : '')
      setNivelActividad(u.nivelActividad ?? 'MODERADO')
      setObjetivoNutricional(u.objetivoNutricional ?? 'MANTENER')
    }

    if (u.deporte) {
      setShowSport(true)
      setDeporte(u.deporte ?? '')
      setDeporteNivel(u.deporteNivel ?? '')
      setDeporteDiasSemana(u.deporteDiasSemana != null ? String(u.deporteDiasSemana) : '')
    }

    if (h) {
      setHouseholdName(h.name ?? '')
      setSupermarket(h.supermarket ?? '')
      setDirNombre(h.direccionNombre ?? '')
      setDirTelefono(h.direccionTelefono ?? '')
      setDirCalle(h.direccionCalle ?? '')
      setDirPiso(h.direccionPiso ?? '')
      setDirCP(h.direccionCodigoPostal ?? '')
      setDirCiudad(h.direccionCiudad ?? '')
    }
  }, [profile])

  // ── Mutaciones ──────────────────────────────────────────────────────
  const saveProfile = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        name: userName,
        assistantName,
        allergens,
        accessibilityMode,
        humorEnabled,
        voiceSpeed,
        highContrast,
        textSize,
        reduceMotion,
        categoriasActivas,
        alergiasPersonalizadas,
      }
      if (/^\d{5}$/.test(codigoPostal)) body.codigoPostal = codigoPostal

      if (showNutrition) {
        if (pesoKg) body.pesoKg = Number(pesoKg)
        if (alturaCm) body.alturaCm = Number(alturaCm)
        if (edadAnos) body.edadAnos = Number(edadAnos)
        body.nivelActividad = nivelActividad
        body.objetivoNutricional = objetivoNutricional
      }

      if (showSport) {
        body.deporte = deporte || null
        body.deporteNivel = deporteNivel || null
        body.deporteDiasSemana = deporteDiasSemana ? Number(deporteDiasSemana) : null
      } else {
        body.deporte = null
        body.deporteNivel = null
        body.deporteDiasSemana = null
      }

      await api.put('/profile', body)

      if (profile?.household) {
        await api.put('/profile/household', {
          name: householdName,
          supermarket,
          direccionNombre: dirNombre,
          direccionTelefono: dirTelefono,
          direccionCalle: dirCalle,
          direccionPiso: dirPiso,
          direccionCodigoPostal: dirCP,
          direccionCiudad: dirCiudad,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudieron guardar los cambios'),
  })

  const addZone = useMutation({
    mutationFn: () => api.post('/pantry/zones', { name: newZoneName, icon: newZoneIcon, temperatureType: 'AMBIENT', position: zones?.length ?? 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantryZones'] })
      setNewZoneName(''); setNewZoneIcon('📦'); setShowAddZone(false)
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo añadir la zona'),
  })

  const updateZone = useMutation({
    mutationFn: (z: { id: string; name: string; icon: string }) => api.put(`/pantry/zones/${z.id}`, { name: z.name, icon: z.icon }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pantryZones'] }); setEditingZone(null) },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo actualizar la zona'),
  })

  const deleteZone = useMutation({
    mutationFn: (id: string) => api.delete(`/pantry/zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantryZones'] }),
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo eliminar la zona'),
  })

  const invite = useMutation({
    mutationFn: () => api.post('/profile/household/invite', { email: inviteEmail }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setInviteMsg('✓ Invitación enviada')
      setInviteEmail('')
    },
    onError: (e: any) => setInviteMsg(e?.message ?? 'No se pudo enviar la invitación'),
  })

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/profile/household/member/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo eliminar el miembro'),
  })

  const addHousehold = useMutation({
    mutationFn: () => api.post('/households', { name: newHouseholdName, type: 'HOME' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] })
      setNewHouseholdName(''); setShowAddHousehold(false); setHouseholdMsg('')
    },
    onError: (e: any) => setHouseholdMsg(e?.message ?? 'No se pudo crear el domicilio'),
  })

  const deleteHousehold = useMutation({
    mutationFn: (id: string) => api.delete(`/households/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['households'] }),
    onError: (e: any) => setHouseholdMsg(e?.message ?? 'No se pudo eliminar el domicilio'),
  })

  const setActiveHousehold = useMutation({
    mutationFn: (id: string) => api.patch('/households/active', { householdId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['pantryZones'] })
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'No se pudo cambiar de domicilio'),
  })

  // ── Helpers de selección múltiple ──────────────────────────────────
  const toggleCategoria = (id: string) => {
    if (!editing || id === 'ALIMENTACION') return
    setCategoriasActivas(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const toggleAllergen = (key: string) => {
    if (!editing) return
    setAllergens(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key])
  }

  const addCustomAllergen = () => {
    const v = newAllergen.trim()
    if (!v) return
    setAlergiasPersonalizadas(prev => [...prev, v])
    setNewAllergen('')
  }

  const removeCustomAllergen = (idx: number) => {
    setAlergiasPersonalizadas(prev => prev.filter((_, i) => i !== idx))
  }

  const nutritionResult = (pesoKg && alturaCm && edadAnos)
    ? calcKcal(Number(pesoKg), Number(alturaCm), Number(edadAnos), nivelActividad, objetivoNutricional)
    : null

  const handleLogout = () => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: logout },
  ])

  return (
    <ScrollView style={[styles.screen, { backgroundColor: a11yTheme.theme.bg }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: a11yTheme.theme.text, fontSize: a11yTheme.scale(24) }]}>Ajustes</Text>
        <TouchableOpacity
          onPress={() => editing ? saveProfile.mutate() : setEditing(true)}
          disabled={saveProfile.isPending}
          style={[styles.editBtn, editing && styles.editBtnActive]}
        >
          <Text style={[styles.editBtnText, editing && styles.editBtnTextActive]}>
            {saveProfile.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Editar'}
          </Text>
        </TouchableOpacity>
      </View>

      {saved && (
        <View style={styles.savedBanner}>
          <Text style={styles.savedBannerText}>✓ Cambios guardados</Text>
        </View>
      )}

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'U'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      {/* 1 — Mi cuenta */}
      <Section title="👤 Mi cuenta">
        <Field label="Nombre">
          <Input value={userName} onChangeText={setUserName} editing={editing} placeholder="Tu nombre" />
        </Field>
        <Field label="Email">
          <Text style={styles.readonlyValue}>{profile?.user?.email ?? user?.email}</Text>
        </Field>
        <Field label="Código postal">
          <Input value={codigoPostal} onChangeText={setCodigoPostal} editing={editing} placeholder="28001" keyboardType="numeric" />
        </Field>
      </Section>

      {/* Objetivo nutricional (opcional) */}
      <Section title="🍎 Objetivo nutricional">
        {!showNutrition ? (
          editing
            ? <CollapsedAdd label="Añadir objetivo nutricional" onPress={() => setShowNutrition(true)} />
            : <Text style={styles.mutedText}>No has configurado un objetivo nutricional.</Text>
        ) : (
          <>
            <View style={styles.row3}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Peso (kg)</FieldLabel>
                <Input value={pesoKg} onChangeText={setPesoKg} editing={editing} placeholder="70" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Altura (cm)</FieldLabel>
                <Input value={alturaCm} onChangeText={setAlturaCm} editing={editing} placeholder="175" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Edad</FieldLabel>
                <Input value={edadAnos} onChangeText={setEdadAnos} editing={editing} placeholder="30" keyboardType="numeric" />
              </View>
            </View>

            <Field label="Nivel de actividad">
              {ACTIVIDAD_OPTS.map(o => (
                <OptionCard key={o.key} label={o.label} desc={o.desc} active={nivelActividad === o.key}
                  disabled={!editing} onPress={() => setNivelActividad(o.key)} />
              ))}
            </Field>

            <Field label="Objetivo">
              {OBJETIVO_OPTS.map(o => (
                <OptionCard key={o.key} label={o.label} desc={o.desc} active={objetivoNutricional === o.key}
                  disabled={!editing} onPress={() => setObjetivoNutricional(o.key)} />
              ))}
            </Field>

            {nutritionResult && (
              <View style={styles.kcalBox}>
                <Text style={styles.kcalText}>≈ {nutritionResult.kcal} kcal/día · {nutritionResult.prot} g proteína</Text>
              </View>
            )}

            {editing && (
              <TouchableOpacity onPress={() => setShowNutrition(false)} style={styles.removeLink}>
                <Text style={styles.removeLinkText}>Ocultar esta sección</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Section>

      {/* Actividad física (opcional) */}
      <Section title="🏃 Actividad física">
        {!showSport ? (
          editing
            ? <CollapsedAdd label="Añadir actividad física" onPress={() => setShowSport(true)} />
            : <Text style={styles.mutedText}>No has configurado una actividad física.</Text>
        ) : (
          <>
            <Field label="Deporte">
              <Input value={deporte} onChangeText={setDeporte} editing={editing} placeholder="Running, natación, gimnasio…" />
            </Field>

            <Field label="Nivel">
              {DEPORTE_NIVEL_OPTS.map(o => (
                <OptionCard key={o.key} label={o.label} desc={o.desc} active={deporteNivel === o.key}
                  disabled={!editing} onPress={() => setDeporteNivel(v => v === o.key ? '' : o.key)} />
              ))}
            </Field>

            <Field label="Días por semana">
              <View style={styles.pillRow}>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <Pill key={n} label={String(n)} active={deporteDiasSemana === String(n)} disabled={!editing}
                    onPress={() => setDeporteDiasSemana(String(n))} />
                ))}
              </View>
            </Field>

            {editing && (
              <TouchableOpacity onPress={() => {
                setShowSport(false); setDeporte(''); setDeporteNivel(''); setDeporteDiasSemana('')
              }} style={styles.removeLink}>
                <Text style={[styles.removeLinkText, { color: theme.danger }]}>Quitar actividad física</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Section>

      {/* 2 — Mi Stoqly */}
      <Section title="🤖 Mi Stoqly">
        <Field label="Nombre del asistente">
          <Input value={assistantName} onChangeText={setAssistantName} editing={editing} placeholder="Stoqly" />
        </Field>

        <Field label="Modo de aviso">
          <View style={styles.pillRow}>
            {ACCESSIBILITY_OPTS.map(o => (
              <Pill key={o.key} label={o.label} active={accessibilityMode === o.key} disabled={!editing}
                onPress={() => setAccessibilityMode(o.key)} />
            ))}
          </View>
        </Field>

        <Field label="Velocidad de voz">
          <View style={styles.pillRow}>
            {VOICE_SPEED_OPTS.map(o => (
              <Pill key={o.key} label={o.label} active={voiceSpeed === o.key} disabled={!editing}
                onPress={() => setVoiceSpeed(o.key)} />
            ))}
          </View>
        </Field>

        <ToggleRow label="Respuestas con humor" value={humorEnabled} onValueChange={setHumorEnabled} disabled={!editing} />
      </Section>

      {/* 3 — Mi hogar */}
      <Section title="🏠 Mi hogar">
        <Field label="Nombre del hogar">
          <Input value={householdName} onChangeText={setHouseholdName} editing={editing} placeholder="Mi casa" />
        </Field>

        <Field label="Supermercado preferido">
          <View style={styles.pillRow}>
            {SUPERMARKETS.map(s => (
              <Pill key={s} label={s} active={supermarket === s} disabled={!editing} onPress={() => setSupermarket(s)} />
            ))}
          </View>
        </Field>

        <FieldLabel>Dirección de entrega</FieldLabel>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Input value={dirNombre} onChangeText={setDirNombre} editing={editing} placeholder="Nombre de quien recibe" />
          </View>
          <View style={{ flex: 1 }}>
            <Input value={dirTelefono} onChangeText={setDirTelefono} editing={editing} placeholder="Teléfono" keyboardType="phone-pad" />
          </View>
        </View>
        <Input value={dirCalle} onChangeText={setDirCalle} editing={editing} placeholder="Calle y número" />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Input value={dirPiso} onChangeText={setDirPiso} editing={editing} placeholder="Piso / puerta" />
          </View>
          <View style={{ flex: 1 }}>
            <Input value={dirCP} onChangeText={setDirCP} editing={editing} placeholder="Código postal" keyboardType="numeric" />
          </View>
        </View>
        <Input value={dirCiudad} onChangeText={setDirCiudad} editing={editing} placeholder="Ciudad" />

        <FieldLabel>Zonas de despensa</FieldLabel>
        {(zones ?? []).map(z => (
          editingZone && editingZone.id === z.id ? (
            <View key={z.id} style={styles.zoneRow}>
              <TextInput value={editingZone.icon} onChangeText={v => setEditingZone({ ...editingZone, icon: v })}
                style={[styles.input, styles.zoneIconInput]} />
              <TextInput value={editingZone.name} onChangeText={v => setEditingZone({ ...editingZone, name: v })}
                style={[styles.input, { flex: 1 }]} />
              <TouchableOpacity onPress={() => updateZone.mutate(editingZone)} style={styles.zoneIconBtn}>
                <Text style={{ color: theme.brand, fontWeight: '700' }}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingZone(null)} style={styles.zoneIconBtn}>
                <Text style={{ color: theme.muted, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View key={z.id} style={styles.zoneRow}>
              <Text style={{ fontSize: 18, width: 32, textAlign: 'center' }}>{z.icon}</Text>
              <Text style={[styles.zoneName, { flex: 1 }]}>{z.name}</Text>
              {editing && (
                <>
                  <TouchableOpacity onPress={() => setEditingZone({ id: z.id, name: z.name, icon: z.icon })} style={styles.zoneIconBtn}>
                    <Text style={{ color: theme.muted }}>✎</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteZone.mutate(z.id)} style={styles.zoneIconBtn}>
                    <Text style={{ color: theme.danger }}>🗑</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )
        ))}

        {editing && (
          showAddZone ? (
            <View style={styles.zoneRow}>
              <TextInput value={newZoneIcon} onChangeText={setNewZoneIcon} placeholder="📦" placeholderTextColor={theme.muted}
                style={[styles.input, styles.zoneIconInput]} />
              <TextInput value={newZoneName} onChangeText={setNewZoneName} placeholder="Nombre de la zona" placeholderTextColor={theme.muted}
                style={[styles.input, { flex: 1 }]} />
              <TouchableOpacity onPress={() => newZoneName && addZone.mutate()} style={styles.zoneIconBtn}>
                <Text style={{ color: theme.brand, fontWeight: '700' }}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddZone(false)} style={styles.zoneIconBtn}>
                <Text style={{ color: theme.muted, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CollapsedAdd label="Añadir zona" onPress={() => setShowAddZone(true)} />
          )
        )}
      </Section>

      {/* 4 — Personas en casa */}
      <Section title="👥 Personas en casa">
        <Text style={styles.mutedText}>
          Todos los miembros comparten la misma despensa y lista de la compra.
        </Text>
        {(profile?.household?.members ?? []).map((m: any) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberInfo}>{m.email} · {m.role}</Text>
            </View>
            {editing && m.id !== profile?.user?.id && (
              <TouchableOpacity onPress={() => removeMember.mutate(m.id)}>
                <Text style={{ color: theme.danger, fontSize: 18 }}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {editing && (
          <View style={styles.row2}>
            <Input value={inviteEmail} onChangeText={t => { setInviteEmail(t); setInviteMsg('') }} editing
              placeholder="Email de la persona a añadir" keyboardType="email-address" />
            <TouchableOpacity onPress={() => inviteEmail && invite.mutate()} disabled={!inviteEmail || invite.isPending}
              style={[styles.inviteBtn, (!inviteEmail || invite.isPending) && { opacity: 0.5 }]}>
              <Text style={styles.inviteBtnText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!inviteMsg && <Text style={[styles.mutedText, { color: inviteMsg.startsWith('✓') ? theme.brand : theme.danger, marginTop: 8 }]}>{inviteMsg}</Text>}
      </Section>

      {/* 5 — Categorías activas */}
      <Section title="🗂️ Categorías activas">
        <Text style={styles.mutedText}>
          Activa solo lo que usas. Cada categoría crea sus propias zonas y alertas.
        </Text>
        {CATEGORIAS.map(cat => {
          const active = categoriasActivas.includes(cat.id)
          const color = TIER_COLORS[cat.tier]
          const disabled = cat.locked || !editing
          return (
            <TouchableOpacity key={cat.id} disabled={disabled} onPress={() => toggleCategoria(cat.id)}
              style={[styles.catRow, active && { borderColor: color }]}>
              <Text style={{ fontSize: 20, width: 32 }}>{cat.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.tierBadgeText, { color }]}>{cat.tier}</Text>
                  </View>
                </View>
                <Text style={styles.catDesc}>{cat.desc}</Text>
              </View>
              <Switch value={active} onValueChange={() => toggleCategoria(cat.id)} disabled={disabled}
                trackColor={{ false: theme.border, true: theme.brand }} thumbColor="#fff" />
            </TouchableOpacity>
          )
        })}
      </Section>

      {/* 6 — Alergias e intolerancias */}
      <Section title="🌾 Tus alergias e intolerancias">
        <View style={styles.pillRow}>
          {Object.entries(ALLERGEN_LABELS).map(([k, v]) => (
            <Pill key={k} label={v} active={allergens.includes(k)} disabled={!editing} color={theme.warn}
              onPress={() => toggleAllergen(k)} />
          ))}
        </View>

        {alergiasPersonalizadas.length > 0 && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {alergiasPersonalizadas.map((a, idx) => (
              <View key={idx} style={styles.zoneRow}>
                <Text style={[styles.zoneName, { flex: 1 }]}>{a}</Text>
                {editing && (
                  <TouchableOpacity onPress={() => removeCustomAllergen(idx)}>
                    <Text style={{ color: theme.danger, fontSize: 16 }}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {editing && (
          <View style={[styles.row2, { marginTop: 12 }]}>
            <Input value={newAllergen} onChangeText={setNewAllergen} editing placeholder="Otra alergia o intolerancia" />
            <TouchableOpacity onPress={addCustomAllergen} disabled={!newAllergen.trim()}
              style={[styles.inviteBtn, !newAllergen.trim() && { opacity: 0.5 }]}>
              <Text style={styles.inviteBtnText}>Añadir</Text>
            </TouchableOpacity>
          </View>
        )}
      </Section>

      {/* 7 — Accesibilidad */}
      <Section title="♿ Accesibilidad">
        <Text style={styles.mutedText}>
          Estas opciones cambian la app al instante en todas las pantallas, no solo aquí. Se guardan en este dispositivo aunque no pulses "Guardar".
        </Text>

        <Field label="Perfil rápido según tu discapacidad">
          <View style={a11yStyles.profileGrid}>
            {A11Y_PROFILES.map(p => {
              const active = a11y.activeMode === p.key
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => onSetA11yProfile(p.key)}
                  style={[
                    a11yStyles.profileBtn,
                    { borderColor: a11yTheme.theme.border, backgroundColor: a11yTheme.theme.bg },
                    active && { borderColor: a11yTheme.theme.brand, backgroundColor: 'rgba(29,158,117,0.12)' },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{p.icon}</Text>
                  <Text style={[a11yStyles.profileLabel, { color: active ? a11yTheme.theme.brand : a11yTheme.theme.text, fontSize: a11yTheme.scale(12) }]}>{p.label}</Text>
                  <Text style={[a11yStyles.profileDesc, { color: a11yTheme.theme.muted, fontSize: a11yTheme.scale(11) }]}>{p.desc}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
          {a11y.activeMode !== 'none' && (
            <TouchableOpacity onPress={() => onSetA11yProfile(a11y.activeMode)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={[styles.mutedText, { textDecorationLine: 'underline' }]}>Quitar perfil activo</Text>
            </TouchableOpacity>
          )}
        </Field>

        <Field label="Tamaño del texto">
          <View style={styles.pillRow}>
            {TEXT_SIZE_OPTS.map(o => (
              <Pill key={o.key} label={o.label} active={textSize === o.key} onPress={() => onSetTextSize(o.key)} />
            ))}
          </View>
        </Field>
        <ToggleRow label="Alto contraste" value={highContrast} onValueChange={onSetHighContrast} />
        <ToggleRow label="Reducir animaciones" value={reduceMotion} onValueChange={onSetReduceMotion} />

        {/* Vista previa en vivo de los ajustes activos */}
        <View style={[a11yStyles.previewBox, { backgroundColor: a11yTheme.theme.bg, borderColor: a11yTheme.theme.border }]}>
          <Text style={{ color: a11yTheme.theme.text, fontSize: a11yTheme.scale(14), fontWeight: '700' }}>
            Así se ve el texto con tus ajustes
          </Text>
          <Text style={{ color: a11yTheme.theme.muted, fontSize: a11yTheme.scale(12), marginTop: 4 }}>
            {a11yTheme.highContrast ? 'Alto contraste activado · ' : ''}
            {a11yTheme.reducedMotion ? 'Animaciones reducidas · ' : ''}
            Tamaño x{FONT_SCALE[a11y.fontSize].toFixed(2)}
          </Text>
        </View>

        <Field label="Patrones de vibración">
          <Text style={[styles.mutedText, { marginBottom: 8 }]}>
            Cada tipo de alerta tiene un patrón de vibración distinto y reconocible. Pulsa para probarlos.
          </Text>
          {VIBRATION_OPTS.map(p => (
            <View key={p.key} style={styles.vibRow}>
              <Text style={{ fontSize: 18, width: 28 }}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.vibLabel}>{p.label}</Text>
                <Text style={styles.vibDesc}>{p.desc}</Text>
              </View>
              <TouchableOpacity onPress={() => Vibration.vibrate(VIBRATION_PATTERNS[p.key])} style={styles.vibBtn}>
                <Text style={styles.vibBtnText}>Probar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Field>

        <View style={styles.onceBox}>
          <Text style={styles.onceTitle}>🎯 Objetivo: certificación ONCE</Text>
          <Text style={styles.mutedText}>
            El alto contraste, el tamaño de texto y la reducción de animaciones ya se aplican en toda la app. Seguimos trabajando en la compatibilidad completa con lectores de pantalla (VoiceOver, TalkBack) y lectura en voz alta.
          </Text>
        </View>
      </Section>

      {/* 8 — Mis domicilios */}
      <Section title="🏡 Mis domicilios">
        {tier === 'FREE' ? (
          <View style={styles.upsellBox}>
            <Text style={styles.upsellTitle}>Gestiona varios domicilios</Text>
            <Text style={styles.mutedText}>
              ¿Tienes segunda casa? Con el plan Hogar puedes gestionar despensas separadas y saber qué tienes en cada una.
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(PLANS_URL)} style={styles.plansBtn}>
              <Text style={styles.plansBtnText}>⚡ Ver planes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {!!householdMsg && <Text style={[styles.mutedText, { color: theme.danger, marginBottom: 8 }]}>{householdMsg}</Text>}
            {(households ?? []).map(h => (
              <View key={h.id} style={[styles.zoneRow, h.isActive && { borderColor: theme.brand }]}>
                <Text style={{ fontSize: 16, width: 28 }}>🏠</Text>
                <Text style={[styles.zoneName, { flex: 1, fontWeight: h.isActive ? '700' : '400' }]}>{h.name}</Text>
                <Text style={styles.mutedText}>{h.itemCount} productos</Text>
                {h.isActive ? (
                  <Text style={{ color: theme.brand, fontWeight: '700', fontSize: 12, marginLeft: 8 }}>Activo</Text>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setActiveHousehold.mutate(h.id)} style={{ marginLeft: 8 }}>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>Activar</Text>
                    </TouchableOpacity>
                    {h.role === 'OWNER' && (
                      <TouchableOpacity onPress={() => deleteHousehold.mutate(h.id)} style={{ marginLeft: 8 }}>
                        <Text style={{ color: theme.danger }}>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            ))}

            {showAddHousehold ? (
              <View style={styles.row2}>
                <Input value={newHouseholdName} onChangeText={setNewHouseholdName} editing placeholder="Nombre del domicilio (ej: Casa de la playa)" />
                <TouchableOpacity onPress={() => newHouseholdName && addHousehold.mutate()} disabled={!newHouseholdName || addHousehold.isPending}
                  style={[styles.inviteBtn, (!newHouseholdName || addHousehold.isPending) && { opacity: 0.5 }]}>
                  <Text style={styles.inviteBtnText}>Añadir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CollapsedAdd label="Añadir domicilio" onPress={() => { setShowAddHousehold(true); setHouseholdMsg('') }} />
            )}
          </>
        )}
      </Section>

      {/* 9 — Mi suscripción */}
      <Section title="💳 Mi suscripción">
        <View style={styles.subscriptionBox}>
          <View>
            <Text style={styles.mutedText}>Plan actual</Text>
            <Text style={styles.subscriptionTier}>{tier}</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL(PLANS_URL)} style={[styles.plansBtn, { marginTop: 0 }]}>
            <Text style={styles.plansBtnText}>⚡ {tier === 'FREE' ? 'Mejorar plan' : 'Gestionar plan'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.mutedText, { marginTop: 10 }]}>
          Compara todos los planes y sus características en app.stoqlyhome.com/plans.
        </Text>
      </Section>

      {/* Version */}
      <View style={styles.version}>
        <Text style={styles.versionText}>Stoqly v1.0.0 · Tu asistente de hogar</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const a11yStyles = StyleSheet.create({
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileBtn: { width: '48%', borderWidth: 1.5, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  profileLabel: { fontWeight: '700', textAlign: 'center' },
  profileDesc: { textAlign: 'center' },
  previewBox: { marginTop: 10, marginBottom: 4, borderWidth: 1, borderRadius: 12, padding: 12 },
})

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: theme.bg },
  header:       { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:        { color: theme.text, fontSize: 24, fontWeight: '900' },
  editBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  editBtnActive:{ backgroundColor: theme.brand, borderColor: theme.brand },
  editBtnText:  { color: theme.muted, fontSize: 13, fontWeight: '700' },
  editBtnTextActive: { color: '#fff' },

  savedBanner:  { marginHorizontal: 20, marginBottom: 12, backgroundColor: 'rgba(29,158,117,0.12)', borderWidth: 1, borderColor: theme.brand, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  savedBannerText: { color: theme.brand, fontWeight: '700', fontSize: 13 },

  profileCard:  { marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, marginBottom: 24, alignItems: 'flex-start' },
  avatarWrap:   { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(29,158,117,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:   { color: theme.brand, fontSize: 24, fontWeight: '900' },
  profileName:  { color: theme.text, fontSize: 20, fontWeight: '700' },
  profileEmail: { color: theme.muted, fontSize: 14, marginTop: 4 },

  section:      { marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '800', marginBottom: 14 },

  field:        { marginBottom: 14 },
  fieldLabel:   { color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },

  input:        { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, fontSize: 14, marginBottom: 10 },
  inputDisabled:{ opacity: 0.6 },
  readonlyValue:{ color: theme.text, fontSize: 14, fontWeight: '500', paddingVertical: 12 },
  mutedText:    { color: theme.muted, fontSize: 13, lineHeight: 18 },

  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg },
  pillText:     { color: theme.muted, fontSize: 13 },

  optionCard:   { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, marginBottom: 8 },
  optionCardActive: { borderColor: theme.brand, backgroundColor: 'rgba(29,158,117,0.1)' },
  optionLabel:  { color: theme.text, fontSize: 14, fontWeight: '600' },
  optionDesc:   { color: theme.muted, fontSize: 12, marginTop: 2 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleLabel:  { color: theme.text, fontSize: 14, fontWeight: '500' },

  collapsedAdd: { borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  collapsedAddText: { color: theme.brand, fontWeight: '700', fontSize: 13 },

  removeLink:   { marginTop: 4, alignItems: 'center' },
  removeLinkText: { color: theme.muted, fontSize: 12, textDecorationLine: 'underline' },

  kcalBox:      { backgroundColor: 'rgba(29,158,117,0.1)', borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'center' },
  kcalText:     { color: theme.brand, fontWeight: '700', fontSize: 13 },

  row2:         { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  row3:         { flexDirection: 'row', gap: 10, marginBottom: 4 },

  zoneRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.bg, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  zoneName:     { color: theme.text, fontSize: 14 },
  zoneIconInput:{ width: 50, textAlign: 'center', marginBottom: 0, paddingHorizontal: 4 },
  zoneIconBtn:  { paddingHorizontal: 6, paddingVertical: 4 },

  memberRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.bg, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  memberName:   { color: theme.text, fontSize: 14, fontWeight: '600' },
  memberInfo:   { color: theme.muted, fontSize: 12, marginTop: 2 },

  inviteBtn:    { backgroundColor: theme.brand, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', minHeight: 46 },
  inviteBtnText:{ color: '#fff', fontWeight: '700', fontSize: 13 },

  catRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.bg, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 8 },
  catLabel:     { color: theme.text, fontSize: 14, fontWeight: '600' },
  catDesc:      { color: theme.muted, fontSize: 12, marginTop: 2 },
  tierBadge:    { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  tierBadgeText:{ fontSize: 10, fontWeight: '700' },

  upsellBox:    { backgroundColor: 'rgba(78,205,196,0.06)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.2)', borderRadius: 12, padding: 14 },
  upsellTitle:  { color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },

  subscriptionBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14 },
  subscriptionTier:{ color: theme.brand, fontSize: 18, fontWeight: '800', marginTop: 2 },

  plansBtn:     { backgroundColor: theme.teal, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  plansBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  vibRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.bg, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  vibLabel:     { color: theme.text, fontSize: 13, fontWeight: '600' },
  vibDesc:      { color: theme.muted, fontSize: 11, marginTop: 2 },
  vibBtn:       { backgroundColor: 'rgba(78,205,196,0.1)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  vibBtnText:   { color: theme.teal, fontSize: 12, fontWeight: '700' },

  onceBox:      { marginTop: 12, backgroundColor: 'rgba(78,205,196,0.06)', borderWidth: 1, borderColor: 'rgba(78,205,196,0.2)', borderRadius: 10, padding: 14 },
  onceTitle:    { color: theme.teal, fontSize: 13, fontWeight: '700', marginBottom: 4 },

  version:      { marginHorizontal: 20, marginBottom: 24, marginTop: 8 },
  versionText:  { color: theme.muted, fontSize: 12, textAlign: 'center' },
  logoutBtn:    { marginHorizontal: 20, backgroundColor: 'rgba(226,75,74,0.1)', borderWidth: 1, borderColor: 'rgba(226,75,74,0.3)', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  logoutText:   { color: theme.danger, fontWeight: '700' },
})
