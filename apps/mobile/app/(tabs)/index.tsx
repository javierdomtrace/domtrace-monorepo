import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Alert, StyleSheet,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { theme } from '@/theme'

interface PantryItem {
  id: string; name: string; quantity: number; unit: string
  status: string; expiryDate?: string; daysUntilExpiry?: number
  zone?: { id: string; name: string; icon: string }
  allergens: string[]
}
interface Zone { id: string; name: string; icon: string; items: PantryItem[] }
interface Summary { total: number; expiringSoon: number; expired: number; zones: Zone[] }

function daysColor(days?: number) {
  if (days === undefined) return theme.muted
  if (days <= 3)  return theme.danger
  if (days <= 7)  return theme.warn
  return theme.brand
}

function ItemCard({ item, onConsume, onDiscard }: {
  item: PantryItem
  onConsume: () => void
  onDiscard: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dc = daysColor(item.daysUntilExpiry)

  return (
    <TouchableOpacity
      onPress={() => setExpanded(v => !v)}
      style={styles.itemCard}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <View style={styles.itemFlex}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemSub}>{item.quantity} {item.unit}</Text>
        </View>
        {item.daysUntilExpiry !== undefined && (
          <View style={[styles.badge, { backgroundColor: dc + '18' }]}>
            <Text style={[styles.badgeText, { color: dc }]}>
              {item.daysUntilExpiry <= 0 ? '¡Caducado!' : `${item.daysUntilExpiry}d`}
            </Text>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.expandedRow}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onConsume() }}
            style={styles.consumeBtn}
          >
            <Text style={styles.consumeText}>✓ Consumido</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onDiscard() }}
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>✕ Descartar</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function PantryScreen() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [search, setSearch] = useState('')

  const { data: summary, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pantry-summary'],
    queryFn: () => api.get<Summary>('/pantry/summary'),
  })

  const consume = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/consume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry-summary'] }),
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry-summary'] }),
  })

  const allItems = summary?.zones?.flatMap(z => z.items) ?? []
  const filtered = search
    ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : null

  const zones = summary?.zones ?? []

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Buenos días,</Text>
            <Text style={styles.userName}>{user?.name?.split(' ')[0] ?? 'Javier'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/scan')} style={styles.scanBtn}>
            <Text style={styles.scanBtnText}>📷 Escanear</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {summary && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{summary.total}</Text>
              <Text style={styles.statLabel}>Productos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: theme.warn }]}>{summary.expiringSoon}</Text>
              <Text style={styles.statLabel}>Caducan pronto</Text>
            </View>
            {summary.expired > 0 && (
              <View style={[styles.statCard, { backgroundColor: 'rgba(226,75,74,0.1)', borderColor: 'rgba(226,75,74,0.3)' }]}>
                <Text style={[styles.statNum, { color: theme.danger }]}>{summary.expired}</Text>
                <Text style={styles.statLabel}>Caducados</Text>
              </View>
            )}
          </View>
        )}

        {/* Search */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en la despensa..."
            placeholderTextColor={theme.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.brand} />}
          showsVerticalScrollIndicator={false}
        >
          {filtered !== null ? (
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.itemSub, { marginBottom: 12 }]}>{filtered.length} resultados</Text>
              {filtered.length === 0
                ? <Text style={[styles.itemSub, { textAlign: 'center', paddingVertical: 32 }]}>Sin resultados para "{search}"</Text>
                : filtered.map(item => (
                    <ItemCard
                      key={item.id} item={item}
                      onConsume={() => consume.mutate(item.id)}
                      onDiscard={() => Alert.alert('Descartar', `¿Descartar ${item.name}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Descartar', style: 'destructive', onPress: () => discard.mutate(item.id) },
                      ])}
                    />
                  ))
              }
            </View>
          ) : (
            zones.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>📦</Text>
                <Text style={styles.emptyTitle}>La despensa está vacía</Text>
                <Text style={[styles.itemSub, { textAlign: 'center', marginTop: 8 }]}>Escanea tu primer producto para empezar</Text>
                <TouchableOpacity onPress={() => router.push('/scan')} style={[styles.scanBtn, { marginTop: 24 }]}>
                  <Text style={styles.scanBtnText}>📷 Escanear producto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              zones.map(zone => (
                <View key={zone.id} style={{ marginBottom: 24 }}>
                  <View style={[styles.row, { gap: 8, marginBottom: 12 }]}>
                    <Text style={{ fontSize: 18 }}>{zone.icon}</Text>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <Text style={styles.itemSub}>({zone.items.length})</Text>
                  </View>
                  {zone.items.map(item => (
                    <ItemCard
                      key={item.id} item={item}
                      onConsume={() => consume.mutate(item.id)}
                      onDiscard={() => Alert.alert('Descartar', `¿Descartar ${item.name}?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Descartar', style: 'destructive', onPress: () => discard.mutate(item.id) },
                      ])}
                    />
                  ))}
                </View>
              ))
            )
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: theme.bg },
  flex1:       { flex: 1 },
  header:      { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  greeting:    { color: theme.muted, fontSize: 14 },
  userName:    { color: theme.text, fontSize: 24, fontWeight: '900' },
  scanBtn:     { backgroundColor: theme.brand, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsRow:    { flexDirection: 'row', gap: 12 },
  statCard:    { flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border },
  statNum:     { fontSize: 24, fontWeight: '900', color: theme.text },
  statLabel:   { color: theme.muted, fontSize: 12, marginTop: 2 },
  searchRow:   { marginTop: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  searchIcon:  { color: theme.muted, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: theme.text, fontSize: 14 },
  clearSearch: { color: theme.muted, fontSize: 18 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemCard:    { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemFlex:    { flex: 1 },
  itemName:    { color: theme.text, fontWeight: '600', fontSize: 16 },
  itemSub:     { color: theme.muted, fontSize: 14, marginTop: 2 },
  badge:       { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText:   { fontSize: 12, fontWeight: '700' },
  expandedRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  consumeBtn:  { flex: 1, backgroundColor: 'rgba(29,158,117,0.2)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  consumeText: { color: theme.brand, fontSize: 14, fontWeight: '600' },
  discardBtn:  { flex: 1, backgroundColor: 'rgba(226,75,74,0.1)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  discardText: { color: theme.danger, fontSize: 14, fontWeight: '600' },
  empty:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle:  { color: theme.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  zoneName:    { color: theme.text, fontWeight: '700', fontSize: 16 },
})
