import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/store/auth'
import { api } from '@/lib/api'
import { theme } from '@/theme'

function SettingRow({ label, value, emoji }: { label: string; value?: string; emoji: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={{ fontSize: 18, width: 32 }}>{emoji}</Text>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value ?? '—'}</Text>
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const { user, logout } = useAuth()

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<any>('/profile'),
  })

  const handleLogout = () => Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: logout },
  ])

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <SettingRow emoji="🏠" label="Hogar" value={profile?.household?.name} />
        <SettingRow emoji="🛒" label="Supermercado preferido" value={profile?.household?.supermarket} />
        <SettingRow emoji="🤖" label="Asistente" value={user?.assistantName ?? 'Stoqly'} />
        <SettingRow emoji="🌾" label="Alergias" value={
          profile?.user?.allergens?.length > 0
            ? profile.user.allergens.join(', ')
            : 'Ninguna'
        } />
      </View>

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

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: theme.bg },
  header:       { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },
  title:        { color: theme.text, fontSize: 24, fontWeight: '900' },
  profileCard:  { marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, marginBottom: 24 },
  avatarWrap:   { width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(29,158,117,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:   { color: theme.brand, fontSize: 24, fontWeight: '900' },
  profileName:  { color: theme.text, fontSize: 20, fontWeight: '700' },
  profileEmail: { color: theme.muted, fontSize: 14, marginTop: 4 },
  infoCard:     { marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: theme.border, marginBottom: 24 },
  settingRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  settingInfo:  { flex: 1, marginLeft: 12 },
  settingLabel: { color: theme.muted, fontSize: 12 },
  settingValue: { color: theme.text, fontSize: 14, fontWeight: '500', marginTop: 2 },
  version:      { marginHorizontal: 20, marginBottom: 24 },
  versionText:  { color: theme.muted, fontSize: 12, textAlign: 'center' },
  logoutBtn:    { marginHorizontal: 20, backgroundColor: 'rgba(226,75,74,0.1)', borderWidth: 1, borderColor: 'rgba(226,75,74,0.3)', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  logoutText:   { color: theme.danger, fontWeight: '700' },
})
