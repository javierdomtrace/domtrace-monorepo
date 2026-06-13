import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { theme } from '@/theme'

interface AlertItem {
  id: string; name: string; quantity: number; unit: string
  daysUntilExpiry?: number; status: string
  zone?: { name: string; icon: string }
}

function urgencyLabel(days?: number) {
  if (days === undefined || days > 7) return { label: 'Pronto', color: theme.warn, bg: 'rgba(239,159,39,0.1)' }
  if (days <= 0)  return { label: '¡Caducado!', color: theme.danger, bg: 'rgba(226,75,74,0.12)' }
  if (days === 1) return { label: 'Hoy',         color: theme.danger, bg: 'rgba(226,75,74,0.12)' }
  if (days <= 3)  return { label: `${days} días`, color: theme.danger, bg: 'rgba(226,75,74,0.1)' }
  return { label: `${days} días`, color: theme.warn, bg: 'rgba(239,159,39,0.1)' }
}

function AlertCard({ item, onConsume, onDiscard, onDonate }: {
  item: AlertItem
  onConsume: () => void
  onDiscard: () => void
  onDonate: () => void
}) {
  const u = urgencyLabel(item.daysUntilExpiry)
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardFlex}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSub}>{item.quantity} {item.unit}{item.zone ? ` · ${item.zone.icon} ${item.zone.name}` : ''}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: u.bg }]}>
          <Text style={[styles.badgeText, { color: u.color }]}>{u.label}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onConsume() }}
          style={styles.consumeBtn}
        >
          <Text style={styles.consumeText}>✓ Consumido</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDonate() }}
          style={styles.donateBtn}
        >
          <Text style={styles.donateText}>🤝 Donar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Descartar', `¿Descartar ${item.name}?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Descartar', style: 'destructive', onPress: onDiscard },
          ])}
          style={styles.discardBtn}
        >
          <Text style={styles.discardText}>✕ Tirar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function AlertsScreen() {
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<{ expiringSoon: AlertItem[]; expired: AlertItem[] }>('/pantry/alerts'),
  })

  const consume = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/consume`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['pantry-summary'] }) },
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['pantry-summary'] }) },
  })

  const donate = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}`, { pendienteDonacion: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const expired  = data?.expired ?? []
  const expiring = data?.expiringSoon ?? []
  const all      = [...expired, ...expiring]

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Alertas</Text>
        <Text style={styles.subtitle}>{all.length} productos requieren atención</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} size="large" />
        </View>
      ) : all.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
          <Text style={styles.emptyTitle}>Todo en orden</Text>
          <Text style={[styles.itemSub, { textAlign: 'center', marginTop: 8 }]}>No hay productos caducando pronto. ¡Buen trabajo!</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.brand} />}
          showsVerticalScrollIndicator={false}
        >
          {expired.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.sectionLabel, { color: theme.danger }]}>⚠️ Caducados ({expired.length})</Text>
              {expired.map(item => (
                <AlertCard key={item.id} item={item}
                  onConsume={() => consume.mutate(item.id)}
                  onDiscard={() => discard.mutate(item.id)}
                  onDonate={() => donate.mutate(item.id)}
                />
              ))}
            </View>
          )}

          {expiring.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.sectionLabel, { color: theme.warn }]}>⏰ Caducan pronto ({expiring.length})</Text>
              {expiring.map(item => (
                <AlertCard key={item.id} item={item}
                  onConsume={() => consume.mutate(item.id)}
                  onDiscard={() => discard.mutate(item.id)}
                  onDonate={() => donate.mutate(item.id)}
                />
              ))}
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: theme.bg },
  flex1:        { flex: 1 },
  header:       { paddingHorizontal: 20, paddingBottom: 16 },
  title:        { color: theme.text, fontSize: 24, fontWeight: '900' },
  subtitle:     { color: theme.muted, fontSize: 14, marginTop: 4 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle:   { color: theme.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sectionLabel: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  card:         { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  cardFlex:     { flex: 1 },
  itemName:     { color: theme.text, fontWeight: '600', fontSize: 16 },
  itemSub:      { color: theme.muted, fontSize: 14 },
  badge:        { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText:    { fontSize: 12, fontWeight: '700' },
  actions:      { flexDirection: 'row', gap: 8 },
  consumeBtn:   { flex: 1, backgroundColor: 'rgba(29,158,117,0.15)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  consumeText:  { color: theme.brand, fontSize: 12, fontWeight: '700' },
  donateBtn:    { flex: 1, backgroundColor: 'rgba(78,205,196,0.1)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  donateText:   { color: theme.teal, fontSize: 12, fontWeight: '700' },
  discardBtn:   { flex: 1, backgroundColor: 'rgba(226,75,74,0.1)', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  discardText:  { color: theme.danger, fontSize: 12, fontWeight: '700' },
})
