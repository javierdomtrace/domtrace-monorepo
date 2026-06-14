import { type ReactNode } from 'react'
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/theme'
import { useA11yTheme } from '@/lib/a11y'

// ── Componentes de UI reutilizables (compartidos entre Ajustes y Más) ──
// Todos los componentes de esta lista aplican automaticamente el ajuste
// de accesibilidad activo (tamano de texto y alto contraste) leyendo el
// store global useA11y, asi que cualquier pantalla que los use se adapta
// sin cambios adicionales.

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <View style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[styles.sectionTitle, { color: t.text, fontSize: scale(16) }]}>{title}</Text>
      {children}
    </View>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  const { theme: t, scale } = useA11yTheme()
  return <Text style={[styles.fieldLabel, { color: t.muted, fontSize: scale(12) }]}>{children}</Text>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  )
}

export function Input({ value, onChangeText, editing, placeholder, keyboardType, multiline }: {
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

export function Pill({ label, active, onPress, disabled, color }: {
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
      <Text style={[
        styles.pillText,
        { color: t.muted, fontSize: scale(13) },
        active && { color: c, fontWeight: '700' },
      ]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function OptionCard({ label, desc, active, onPress, disabled }: {
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

export function ToggleRow({ label, value, onValueChange, disabled }: {
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

export function CollapsedAdd({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.collapsedAdd, { borderColor: t.borderStrong }]}>
      <Text style={[styles.collapsedAddText, { color: t.brand, fontSize: scale(13) }]}>＋ {label}</Text>
    </TouchableOpacity>
  )
}

// Cabecera estándar para las pantallas de la pestaña "Más" (con botón volver)
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme: t, scale } = useA11yTheme()
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: t.brand, fontSize: scale(15) }]}>‹ Volver</Text>
        </TouchableOpacity>
        {right}
      </View>
      <Text style={[styles.headerTitle, { color: t.text, fontSize: scale(24) }]}>{title}</Text>
      {subtitle ? <Text style={[styles.headerSubtitle, { color: t.muted, fontSize: scale(13) }]}>{subtitle}</Text> : null}
    </View>
  )
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: any }) {
  const Comp: any = onPress ? TouchableOpacity : View
  const { theme: t } = useA11yTheme()
  return (
    <Comp onPress={onPress} activeOpacity={onPress ? 0.85 : undefined} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>
      {children}
    </Comp>
  )
}

export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  const { theme: t, scale } = useA11yTheme()
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: scale(40), marginBottom: 16 }}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: t.text, fontSize: scale(18) }]}>{title}</Text>
      {desc ? <Text style={[styles.emptyDesc, { color: t.muted, fontSize: scale(14) }]}>{desc}</Text> : null}
    </View>
  )
}

// Estilos base (sin escalar). Se mantienen exportados para compatibilidad con
// pantallas existentes que usan `styles.screen`, `styles.card`, etc para
// layout (margenes, padding, radios). Los componentes de arriba ya aplican
// color y tamano de fuente accesibles encima de estos estilos base.
export const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: theme.bg },
  header:       { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn:      { paddingVertical: 6, paddingRight: 8 },
  backBtnText:  { color: theme.brand, fontSize: 15, fontWeight: '700' },
  headerTitle:  { color: theme.text, fontSize: 24, fontWeight: '900' },
  headerSubtitle: { color: theme.muted, fontSize: 13, marginTop: 4 },

  section:      { marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '800', marginBottom: 14 },

  field:        { marginBottom: 14 },
  fieldLabel:   { color: theme.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },

  input:        { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.text, fontSize: 14, marginBottom: 10 },
  inputDisabled:{ opacity: 0.6 },

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

  card:         { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border, marginHorizontal: 20 },
  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  badge:        { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText:    { fontSize: 12, fontWeight: '700' },

  empty:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 20 },
  emptyTitle:   { color: theme.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyDesc:    { color: theme.muted, fontSize: 14, marginTop: 8, textAlign: 'center' },

  primaryBtn:   { backgroundColor: theme.brand, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginHorizontal: 20, marginTop: 4 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginHorizontal: 20, marginTop: 8 },
  secondaryBtnText: { color: theme.text, fontWeight: '600', fontSize: 14 },
})

export function daysColor(days?: number) {
  if (days === undefined || days === null) return theme.muted
  if (days <= 3) return theme.danger
  if (days <= 7) return theme.warn
  return theme.brand
}
