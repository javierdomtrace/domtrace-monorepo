import { type ReactNode } from 'react'
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/theme'

// ── Componentes de UI reutilizables (compartidos entre Ajustes y Más) ──

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
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
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editing}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      keyboardType={keyboardType ?? 'default'}
      multiline={multiline}
      style={[styles.input, !editing && styles.inputDisabled, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
    />
  )
}

export function Pill({ label, active, onPress, disabled, color }: {
  label: string; active: boolean; onPress: () => void; disabled?: boolean; color?: string
}) {
  const c = color ?? theme.brand
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.pill, active && { borderColor: c, backgroundColor: c + '22' }]}>
      <Text style={[styles.pillText, active && { color: c, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function OptionCard({ label, desc, active, onPress, disabled }: {
  label: string; desc?: string; active: boolean; onPress: () => void; disabled?: boolean
}) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.optionCard, active && styles.optionCardActive]}>
      <Text style={[styles.optionLabel, active && { color: theme.brand }]}>{label}</Text>
      {desc ? <Text style={styles.optionDesc}>{desc}</Text> : null}
    </TouchableOpacity>
  )
}

export function ToggleRow({ label, value, onValueChange, disabled }: {
  label: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled}
        trackColor={{ false: theme.border, true: theme.brand }} thumbColor="#fff" />
    </View>
  )
}

export function CollapsedAdd({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.collapsedAdd}>
      <Text style={styles.collapsedAddText}>＋ {label}</Text>
    </TouchableOpacity>
  )
}

// Cabecera estándar para las pantallas de la pestaña "Más" (con botón volver)
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        {right}
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: any }) {
  const Comp: any = onPress ? TouchableOpacity : View
  return (
    <Comp onPress={onPress} activeOpacity={onPress ? 0.85 : undefined} style={[styles.card, style]}>
      {children}
    </Comp>
  )
}

export function EmptyState({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {desc ? <Text style={styles.emptyDesc}>{desc}</Text> : null}
    </View>
  )
}

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
