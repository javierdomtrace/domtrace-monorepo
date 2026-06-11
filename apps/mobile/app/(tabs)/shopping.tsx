import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { api } from '@/lib/api'
import { theme } from '@/theme'

interface ShoppingItem {
  id: string; name: string; quantity: number; unit: string
  supermarket?: string; checked: boolean
}

export default function ShoppingScreen() {
  const qc = useQueryClient()
  const [newItem, setNewItem] = useState('')
  const [qty, setQty] = useState('1')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shopping'],
    queryFn: async () => {
      const d = await api.get<any>('/shopping')
      return (Array.isArray(d) ? d : d?.items ?? []) as ShoppingItem[]
    },
  })

  const add = useMutation({
    mutationFn: (body: { name: string; quantity: number }) =>
      api.post('/shopping', { ...body, unit: 'u' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shopping'] }); setNewItem(''); setQty('1') },
  })

  const check = useMutation({
    mutationFn: (id: string) => api.patch(`/shopping/${id}/check`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shopping/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const items   = data ?? []
  const pending = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)

  const handleAdd = () => {
    if (!newItem.trim()) return
    add.mutate({ name: newItem.trim(), quantity: parseInt(qty) || 1 })
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Lista de la compra</Text>
        <Text style={styles.subtitle}>{pending.length} pendiente{pending.length !== 1 ? 's' : ''}</Text>

        {/* Add item */}
        <View style={styles.addRow}>
          <View style={styles.qtyWrap}>
            <TextInput
              style={styles.qtyInput}
              value={qty}
              onChangeText={setQty}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
          <View style={styles.nameWrap}>
            <TextInput
              style={styles.nameInput}
              placeholder="Añadir producto..."
              placeholderTextColor={theme.muted}
              value={newItem}
              onChangeText={setNewItem}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
          </View>
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!newItem.trim() || add.isPending}
            style={[styles.addBtn, { opacity: !newItem.trim() ? 0.4 : 1 }]}
          >
            {add.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.addBtnText}>+</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

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
          {pending.length === 0 && checked.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🛒</Text>
              <Text style={styles.emptyTitle}>Lista vacía</Text>
              <Text style={[styles.itemSub, { textAlign: 'center', marginTop: 8 }]}>Añade productos o pide a Stoqly que te proponga la compra</Text>
            </View>
          )}

          {/* Pending */}
          {pending.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); check.mutate(item.id) }}
              style={styles.itemRow}
              activeOpacity={0.8}
            >
              <View style={styles.circle} />
              <View style={styles.flex1}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.supermarket && <Text style={styles.itemSub}>{item.supermarket}</Text>}
              </View>
              <Text style={styles.itemSub}>{item.quantity} {item.unit}</Text>
            </TouchableOpacity>
          ))}

          {/* Checked */}
          {checked.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <View style={styles.checkedHeader}>
                <Text style={styles.itemSub}>En el carro ({checked.length})</Text>
                <TouchableOpacity onPress={() => Alert.alert('Limpiar', '¿Eliminar los productos ya cogidos?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Limpiar', style: 'destructive', onPress: () => checked.forEach(i => remove.mutate(i.id)) },
                ])}>
                  <Text style={styles.clearText}>Limpiar</Text>
                </TouchableOpacity>
              </View>
              {checked.map(item => (
                <View key={item.id} style={[styles.itemRow, { opacity: 0.5 }]}>
                  <View style={styles.circleChecked}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                  <Text style={[styles.itemName, styles.strikethrough, styles.flex1]}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.quantity} {item.unit}</Text>
                </View>
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
  screen:        { flex: 1, backgroundColor: theme.bg },
  flex1:         { flex: 1 },
  header:        { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  title:         { color: theme.text, fontSize: 24, fontWeight: '900' },
  subtitle:      { color: theme.muted, fontSize: 14, marginTop: 4 },
  addRow:        { marginTop: 16, flexDirection: 'row', gap: 8 },
  qtyWrap:       { width: 64, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qtyInput:      { color: theme.text, textAlign: 'center', fontSize: 14, paddingVertical: 12, width: '100%' },
  nameWrap:      { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  nameInput:     { flex: 1, paddingVertical: 12, color: theme.text, fontSize: 14 },
  addBtn:        { backgroundColor: theme.brand, borderRadius: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  addBtnText:    { color: '#fff', fontSize: 20, fontWeight: '700' },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:         { alignItems: 'center', paddingVertical: 80 },
  emptyTitle:    { color: theme.text, fontSize: 18, fontWeight: '700' },
  itemRow:       { backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' },
  circle:        { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.muted, marginRight: 12 },
  circleChecked: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.brand, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkMark:     { color: '#fff', fontSize: 12, fontWeight: '700' },
  itemName:      { color: theme.text, fontWeight: '500' },
  itemSub:       { color: theme.muted, fontSize: 14 },
  strikethrough: { textDecorationLine: 'line-through' },
  checkedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  clearText:     { color: theme.danger, fontSize: 12, fontWeight: '600' },
})
