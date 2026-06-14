import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Alert, StyleSheet, Modal,
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
interface ZoneOption { id: string; name: string; icon: string; temperatureType?: string; itemCount?: number }

const TEMP_OPTIONS: { value: 'AMBIENT' | 'COLD' | 'FROZEN' | 'WARM'; label: string; icon: string }[] = [
  { value: 'AMBIENT', label: 'Ambiente', icon: '🌡️' },
  { value: 'COLD', label: 'Frío', icon: '🧊' },
  { value: 'FROZEN', label: 'Congelador', icon: '❄️' },
  { value: 'WARM', label: 'Cálido', icon: '🔥' },
]

function daysColor(days?: number) {
  if (days === undefined) return theme.muted
  if (days <= 3)  return theme.danger
  if (days <= 7)  return theme.warn
  return theme.brand
}

function ItemCard({ item, onConsume, onDiscard, onMove }: {
  item: PantryItem
  onConsume: () => void
  onDiscard: () => void
  onMove: () => void
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
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMove() }}
            style={styles.moveBtn}
          >
            <Text style={styles.moveText}>📍 Mover</Text>
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

function ZonePickerModal({ visible, item, zones, onSelect, onClose, onCreateNew }: {
  visible: boolean
  item: PantryItem | null
  zones: ZoneOption[]
  onSelect: (toZoneId: string | null) => void
  onClose: () => void
  onCreateNew: () => void
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Mover{item ? ` "${item.name}"` : ''}</Text>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.zoneOption} onPress={() => onSelect(null)}>
              <Text style={styles.zoneOptionIcon}>📦</Text>
              <Text style={styles.zoneOptionName}>Sin ubicación</Text>
              {!item?.zone && <Text style={styles.zoneOptionCurrent}>Actual</Text>}
            </TouchableOpacity>
            {zones.map(z => (
              <TouchableOpacity key={z.id} style={styles.zoneOption} onPress={() => onSelect(z.id)}>
                <Text style={styles.zoneOptionIcon}>{z.icon}</Text>
                <Text style={styles.zoneOptionName}>{z.name}</Text>
                {item?.zone?.id === z.id && <Text style={styles.zoneOptionCurrent}>Actual</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.newZoneBtn} onPress={onCreateNew}>
            <Text style={styles.newZoneBtnText}>＋ Crear nueva zona</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function CreateZoneModal({ visible, onCreate, onClose, creating }: {
  visible: boolean
  onCreate: (data: { name: string; icon: string; temperatureType: string }) => void
  onClose: () => void
  creating: boolean
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📦')
  const [temp, setTemp] = useState<'AMBIENT' | 'COLD' | 'FROZEN' | 'WARM'>('AMBIENT')

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Nueva zona</Text>

          <Text style={styles.manualLabel}>Nombre</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Ej: Despensa, Nevera, Garaje..."
            placeholderTextColor={theme.muted}
            value={name} onChangeText={setName}
          />

          <Text style={styles.manualLabel}>Icono</Text>
          <TextInput
            style={[styles.modalInput, { width: 72, textAlign: 'center', fontSize: 20 }]}
            value={icon} onChangeText={setIcon} maxLength={2}
          />

          <Text style={styles.manualLabel}>Temperatura</Text>
          <View style={styles.tempRow}>
            {TEMP_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.tempPill, temp === opt.value && styles.tempPillActive]}
                onPress={() => setTemp(opt.value)}
              >
                <Text style={[styles.tempPillText, temp === opt.value && styles.tempPillTextActive]}>
                  {opt.icon} {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.manualButtons, { marginTop: 20 }]}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => name.trim() && onCreate({ name: name.trim(), icon: icon.trim() || '📦', temperatureType: temp })}
              disabled={!name.trim() || creating}
              style={[styles.confirmBtn, { opacity: name.trim() && !creating ? 1 : 0.4 }]}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.confirmBtnText}>Crear →</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function PantryScreen() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [search, setSearch] = useState('')
  const [movingItem, setMovingItem] = useState<PantryItem | null>(null)
  const [showCreateZone, setShowCreateZone] = useState(false)

  const { data: summary, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pantry-summary'],
    queryFn: () => api.get<Summary>('/pantry/summary'),
  })

  const { data: zoneOptions } = useQuery({
    queryKey: ['pantry-zones'],
    queryFn: () => api.get<ZoneOption[]>('/pantry/zones'),
  })

  const consume = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/consume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry-summary'] }),
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pantry-summary'] }),
  })

  const move = useMutation({
    mutationFn: ({ id, toZoneId }: { id: string; toZoneId: string | null }) =>
      api.patch(`/items/${id}/move`, { toZoneId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry-summary'] })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setMovingItem(null)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'No se pudo mover el producto'
      Alert.alert('Error', message)
    },
  })

  const createZone = useMutation({
    mutationFn: (body: { name: string; icon: string; temperatureType: string; position: number }) =>
      api.post<ZoneOption>('/pantry/zones', body),
    onSuccess: (zone) => {
      qc.invalidateQueries({ queryKey: ['pantry-zones'] })
      qc.invalidateQueries({ queryKey: ['pantry-summary'] })
      setShowCreateZone(false)
      // Si se creó la zona desde "Mover", asignar directamente el producto a la nueva zona.
      if (movingItem) move.mutate({ id: movingItem.id, toZoneId: zone.id })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'No se pudo crear la zona'
      Alert.alert('Error', message)
    },
  })

  const allItems = summary?.zones?.flatMap(z => z.items) ?? []
  const filtered = search
    ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : null

  const zones = summary?.zones ?? []
  const realZones = (zoneOptions ?? []).filter(z => z.id !== 'unassigned')

  const renderItem = (item: PantryItem) => (
    <ItemCard
      key={item.id} item={item}
      onConsume={() => consume.mutate(item.id)}
      onMove={() => setMovingItem(item)}
      onDiscard={() => Alert.alert('Descartar', `¿Descartar ${item.name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => discard.mutate(item.id) },
      ])}
    />
  )

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
                : filtered.map(renderItem)
              }
            </View>
          ) : (
            <>
              {/* Gestión de zonas */}
              <View style={[styles.row, { marginBottom: 16 }]}>
                <Text style={styles.sectionTitle}>Zonas de la despensa</Text>
                <TouchableOpacity onPress={() => setShowCreateZone(true)} style={styles.addZoneBtn}>
                  <Text style={styles.addZoneBtnText}>＋ Nueva zona</Text>
                </TouchableOpacity>
              </View>

              {zones.length === 0 ? (
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
                    {zone.items.map(renderItem)}
                  </View>
                ))
              )}
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <ZonePickerModal
        visible={!!movingItem}
        item={movingItem}
        zones={realZones}
        onClose={() => setMovingItem(null)}
        onCreateNew={() => setShowCreateZone(true)}
        onSelect={(toZoneId) => {
          if (movingItem) move.mutate({ id: movingItem.id, toZoneId })
        }}
      />

      <CreateZoneModal
        visible={showCreateZone}
        creating={createZone.isPending}
        onClose={() => setShowCreateZone(false)}
        onCreate={(data) => createZone.mutate({ ...data, position: realZones.length })}
      />
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
  moveBtn:     { flex: 1, backgroundColor: 'rgba(74,144,226,0.15)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  moveText:    { color: '#4A90E2', fontSize: 14, fontWeight: '600' },
  discardBtn:  { flex: 1, backgroundColor: 'rgba(226,75,74,0.1)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  discardText: { color: theme.danger, fontSize: 14, fontWeight: '600' },
  empty:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle:  { color: theme.text, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  zoneName:    { color: theme.text, fontWeight: '700', fontSize: 16 },
  sectionTitle: { color: theme.text, fontWeight: '800', fontSize: 16 },
  addZoneBtn:  { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  addZoneBtnText: { color: theme.brand, fontSize: 13, fontWeight: '700' },

  // Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalTitle:  { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  modalCancelBtn: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  modalInput:  { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, fontSize: 16, marginBottom: 16 },

  zoneOption:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  zoneOptionIcon: { fontSize: 20 },
  zoneOptionName: { flex: 1, color: theme.text, fontSize: 15, fontWeight: '600' },
  zoneOptionCurrent: { color: theme.brand, fontSize: 12, fontWeight: '700' },
  newZoneBtn:  { paddingVertical: 14, alignItems: 'center' },
  newZoneBtnText: { color: theme.brand, fontSize: 14, fontWeight: '700' },

  manualLabel: { color: theme.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  manualButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn:   { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: theme.muted, fontWeight: '600' },
  confirmBtn:  { flex: 2, backgroundColor: theme.brand, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },

  tempRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tempPill:    { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  tempPillActive: { backgroundColor: theme.brand + '22', borderColor: theme.brand },
  tempPillText: { color: theme.muted, fontSize: 13, fontWeight: '600' },
  tempPillTextActive: { color: theme.brand },
})
