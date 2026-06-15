import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, Pill, EmptyState, CollapsedAdd, styles as ui } from '@/components/ui'

interface Supplement {
  id: string
  name: string
  quantity: number
  unit: string
  dosisDesc?: string
  frecuenciaToma?: string
  notes?: string
  lowStock: boolean
}

const FRECUENCIA_LABELS: Record<string, string> = {
  DIARIO: '📅 Diario',
  CADA_8H: '⏱ Cada 8h',
  CADA_12H: '⏱ Cada 12h',
  SEMANAL: '📆 Semanal',
  SEGUN_NECESIDAD: '💡 Según necesidad',
}
const FRECUENCIA_OPTS = Object.entries(FRECUENCIA_LABELS)
const UNIT_OPTS = ['cáps.', 'comp.', 'ml', 'g', 'sobres', 'u']

export default function SupplementsScreen() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const scanLock = useRef(false)

  const [form, setForm] = useState({
    name: '', quantity: '30', unit: 'cáps.', dosisDesc: '', frecuenciaToma: '', notes: '', barcode: '', barcodeIsNew: false,
  })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['supplements'],
    queryFn: () => api.get('/supplements'),
  })
  const items: Supplement[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const lowStockCount: number = data?.lowStockCount ?? 0

  const resetForm = () => setForm({ name: '', quantity: '30', unit: 'cáps.', dosisDesc: '', frecuenciaToma: '', notes: '', barcode: '', barcodeIsNew: false })

  const add = useMutation({
    mutationFn: async () => {
      const result = await api.post('/supplements', {
        name: form.name.trim(),
        quantity: parseFloat(form.quantity) || 30,
        unit: form.unit,
        ...(form.dosisDesc && { dosisDesc: form.dosisDesc }),
        ...(form.frecuenciaToma && { frecuenciaToma: form.frecuenciaToma }),
        ...(form.notes && { notes: form.notes }),
        ...(form.barcode && { barcode: form.barcode }),
      })
      if (form.barcodeIsNew && form.barcode && form.name.trim()) {
        api.post('/product/contribute', { barcode: form.barcode, name: form.name.trim(), categoryId: 'SUPLEMENTOS' }).catch(() => {})
      }
      return result
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplements'] }); resetForm(); setAdding(false) },
  })

  const consume = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) => api.patch(`/supplements/${id}`, { quantity: Math.max(0, qty - 1) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })

  const restock = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) => api.patch(`/supplements/${id}`, { quantity: qty + 30 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.delete(`/supplements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/supplements/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplements'] }); setEditingId(null) },
  })

  const confirmDelete = (item: Supplement) => {
    Alert.alert('Eliminar suplemento', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => discard.mutate(item.id) },
    ])
  }

  const onScan = async (code: string) => {
    if (scanLock.current) return
    scanLock.current = true
    setShowScanner(false)
    setAdding(true)
    try {
      const prod = await api.get<any>(`/product/${code}`)
      if (prod?.name) {
        const nombreCompleto = prod.brand ? `${prod.name} ${prod.brand}`.trim() : prod.name
        setForm(f => ({ ...f, name: nombreCompleto, barcode: code, barcodeIsNew: false }))
      } else {
        setForm(f => ({ ...f, name: '', barcode: code, barcodeIsNew: true }))
      }
    } catch {
      setForm(f => ({ ...f, name: '', barcode: code, barcodeIsNew: true }))
    } finally {
      setTimeout(() => { scanLock.current = false }, 1500)
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader
        title="💊 Suplementos"
        subtitle={`${items.length} suplemento${items.length !== 1 ? 's' : ''}${lowStockCount > 0 ? ` · ${lowStockCount} con stock bajo` : ''}`}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 14 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            onPress={async () => {
              if (!permission?.granted) await requestPermission()
              setShowScanner(v => !v)
            }}
          >
            <Text style={styles.actionBtnText}>📷 {showScanner ? 'Cerrar cámara' : 'Escanear'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, { flex: 1 }]} onPress={() => setAdding(v => !v)}>
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>＋ Añadir</Text>
          </TouchableOpacity>
        </View>

        {showScanner && (
          <View style={[ui.card, { padding: 0, overflow: 'hidden' }]}>
            {permission?.granted ? (
              <CameraView
                style={{ width: '100%', height: 240 }}
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'datamatrix'] }}
                onBarcodeScanned={(res) => onScan(res.data)}
              />
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Se necesita acceso a la cámara</Text>
              </View>
            )}
            <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>
              Centra el código de barras en la cámara
            </Text>
          </View>
        )}

        {adding ? (
          <Section title="Nuevo suplemento">
            <Text style={ui.fieldLabel}>Nombre</Text>
            <TextInput value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Ej: Vitamina D3, Magnesio, Omega-3..." placeholderTextColor={theme.muted} style={ui.input} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Stock actual</Text>
                <TextInput value={form.quantity} onChangeText={v => setForm(f => ({ ...f, quantity: v }))} keyboardType="numeric" style={ui.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Unidad</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {UNIT_OPTS.map(u => <Pill key={u} label={u} active={form.unit === u} onPress={() => setForm(f => ({ ...f, unit: u }))} />)}
                </View>
              </View>
            </View>

            <Text style={ui.fieldLabel}>Dosis (opcional)</Text>
            <TextInput value={form.dosisDesc} onChangeText={v => setForm(f => ({ ...f, dosisDesc: v }))} placeholder="Ej: 1 cápsula en ayunas" placeholderTextColor={theme.muted} style={ui.input} />

            <Text style={ui.fieldLabel}>Frecuencia</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <Pill label="Sin especificar" active={!form.frecuenciaToma} onPress={() => setForm(f => ({ ...f, frecuenciaToma: '' }))} />
              {FRECUENCIA_OPTS.map(([k, v]) => <Pill key={k} label={v} active={form.frecuenciaToma === k} onPress={() => setForm(f => ({ ...f, frecuenciaToma: k }))} />)}
            </View>

            <Text style={ui.fieldLabel}>Notas (opcional)</Text>
            <TextInput value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Ej: Con vitamina K2, tomar con comida grasa..." placeholderTextColor={theme.muted} style={ui.input} />

            <Text style={ui.fieldLabel}>Código de barras (opcional)</Text>
            <TextInput value={form.barcode} onChangeText={v => setForm(f => ({ ...f, barcode: v.trim(), barcodeIsNew: true }))} placeholder="Ej: 8410091012345" placeholderTextColor={theme.muted} keyboardType="numeric" style={ui.input} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[ui.secondaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }]} onPress={() => { setAdding(false); resetForm() }}>
                <Text style={ui.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ui.primaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }, (!form.name.trim() || add.isPending) && { opacity: 0.5 }]}
                disabled={!form.name.trim() || add.isPending}
                onPress={() => add.mutate()}
              >
                {add.isPending ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Añadir</Text>}
              </TouchableOpacity>
            </View>
          </Section>
        ) : (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <CollapsedAdd label="Añadir suplemento" onPress={() => setAdding(true)} />
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <EmptyState icon="💊" title="Sin suplementos registrados" desc="Añade tus vitaminas, minerales u otros suplementos y Stoqly te avisará cuando te queden pocos." />
        ) : (
          items.map(item => {
            const expanded = expandedId === item.id
            const editing = editingId === item.id
            const stockPct = Math.min(100, (item.quantity / 30) * 100)
            const stockColor = item.quantity <= 5 ? theme.danger : item.quantity <= 10 ? theme.warn : theme.brand
            return (
              <View key={item.id}>
                <View style={[ui.card, item.lowStock && { borderColor: 'rgba(239,159,39,0.4)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.icon}><Text style={{ fontSize: 18 }}>💊</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.name}>{item.name}</Text>
                        {item.lowStock && <Text style={styles.lowBadge}>⚠ Stock bajo</Text>}
                        {item.frecuenciaToma && <Text style={styles.freqBadge}>{FRECUENCIA_LABELS[item.frecuenciaToma] ?? item.frecuenciaToma}</Text>}
                      </View>
                      {item.dosisDesc ? <Text style={styles.dosis}>{item.dosisDesc}</Text> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <View style={styles.stockTrack}><View style={[styles.stockFill, { width: `${stockPct}%`, backgroundColor: stockColor }]} /></View>
                        <Text style={[styles.stockText, { color: stockColor }]}>{item.quantity} {item.unit}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: 'rgba(29,158,117,0.1)' }]} onPress={() => consume.mutate({ id: item.id, qty: item.quantity })}>
                      <Text style={{ color: theme.brand, fontWeight: '700' }}>－ 1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: 'rgba(127,119,221,0.1)' }]} onPress={() => restock.mutate({ id: item.id, qty: item.quantity })}>
                      <Text style={{ color: '#7F77DD', fontWeight: '700' }}>＋ 30</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.bg }]} onPress={() => setExpandedId(v => v === item.id ? null : item.id)}>
                      <Text style={{ color: theme.muted, fontWeight: '700' }}>{expanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                  </View>

                  {expanded && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                      {item.notes ? <Text style={styles.notes}>📝 {item.notes}</Text> : null}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={() => setEditingId(editing ? null : item.id)}>
                          <Text style={{ color: theme.brand, fontSize: 13, fontWeight: '700' }}>✏️ Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(item)}>
                          <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '700' }}>🗑 Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {editing && (
                  <SupplementEditForm
                    item={item}
                    loading={update.isPending}
                    onCancel={() => setEditingId(null)}
                    onSave={(data) => update.mutate({ id: item.id, data })}
                  />
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function SupplementEditForm({ item, onSave, onCancel, loading }: {
  item: Supplement; onSave: (data: any) => void; onCancel: () => void; loading: boolean
}) {
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [unit, setUnit] = useState(item.unit)
  const [dosisDesc, setDosisDesc] = useState(item.dosisDesc ?? '')
  const [frecuenciaToma, setFrecuencia] = useState(item.frecuenciaToma ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')

  return (
    <View style={[ui.card, { borderColor: theme.brand }]}>
      <Text style={{ color: theme.brand, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>Editar suplemento</Text>
      <Text style={ui.fieldLabel}>Nombre</Text>
      <TextInput value={name} onChangeText={setName} style={ui.input} placeholderTextColor={theme.muted} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={ui.fieldLabel}>Stock</Text>
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={ui.input} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ui.fieldLabel}>Unidad</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {UNIT_OPTS.map(u => <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />)}
          </View>
        </View>
      </View>
      <Text style={ui.fieldLabel}>Dosis</Text>
      <TextInput value={dosisDesc} onChangeText={setDosisDesc} placeholder="Ej: 1 cápsula en ayunas" placeholderTextColor={theme.muted} style={ui.input} />
      <Text style={ui.fieldLabel}>Frecuencia</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <Pill label="—" active={!frecuenciaToma} onPress={() => setFrecuencia('')} />
        {FRECUENCIA_OPTS.map(([k, v]) => <Pill key={k} label={v} active={frecuenciaToma === k} onPress={() => setFrecuencia(k)} />)}
      </View>
      <Text style={ui.fieldLabel}>Notas</Text>
      <TextInput value={notes} onChangeText={setNotes} style={ui.input} placeholderTextColor={theme.muted} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          style={[ui.primaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }, (!name.trim() || loading) && { opacity: 0.5 }]}
          disabled={!name.trim() || loading}
          onPress={() => onSave({ name, quantity: parseFloat(quantity) || item.quantity, unit, dosisDesc: dosisDesc || null, frecuenciaToma: frecuenciaToma || null, notes: notes || null })}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar cambios</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[ui.secondaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }]} onPress={onCancel}>
          <Text style={ui.secondaryBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.surface },
  actionBtnPrimary: { backgroundColor: theme.brand, borderColor: theme.brand },
  actionBtnText: { color: theme.text, fontWeight: '700', fontSize: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(29,158,117,0.1)', alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.text, fontSize: 15, fontWeight: '700' },
  lowBadge: { fontSize: 11, color: theme.warn, backgroundColor: 'rgba(239,159,39,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, fontWeight: '700' },
  freqBadge: { fontSize: 11, color: theme.muted, backgroundColor: theme.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  dosis: { color: theme.muted, fontSize: 12, marginTop: 2 },
  stockTrack: { flex: 1, height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' },
  stockFill: { height: '100%', borderRadius: 2 },
  stockText: { fontSize: 12, fontWeight: '700' },
  smallBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  notes: { color: theme.muted, fontSize: 13, marginBottom: 10 },
})
