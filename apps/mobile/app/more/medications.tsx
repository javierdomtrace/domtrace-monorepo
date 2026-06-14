import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Modal, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, Pill, EmptyState, CollapsedAdd, styles as ui } from '@/components/ui'

const PURPLE = '#7F77DD'

const FRECUENCIA_LABELS: Record<string, string> = {
  DIARIO: '📅 Diario',
  CADA_8H: '⏱ Cada 8h',
  CADA_12H: '⏱ Cada 12h',
  SEMANAL: '📆 Semanal',
  SEGUN_NECESIDAD: '💡 Según necesidad',
}
const FRECUENCIA_OPTS = Object.keys(FRECUENCIA_LABELS)
const UNIT_OPTS = ['comp.', 'cáps.', 'ml', 'mg', 'sobres', 'ampollas', 'u']

interface Medication {
  id: string
  name: string
  quantity: number
  unit: string
  dosisDesc?: string
  frecuenciaToma?: string
  notes?: string
  expiryDate?: string
  daysUntilExpiry?: number | null
  lowStock: boolean
  expiringSoon: boolean
  expired: boolean
}

interface Pharmacy {
  id: string
  name: string
  address: string
  distance: number
  lat: number
  lon: number
  phone?: string
  openingHours?: string
}

function expiryLabel(days?: number | null) {
  if (days === undefined || days === null) return null
  if (days < 0) return `Caducó hace ${Math.abs(days)} días`
  if (days === 0) return 'Caduca hoy'
  return `Caduca en ${days} días`
}

function stockColor(qty: number) {
  if (qty <= 3) return theme.danger
  if (qty <= 7) return theme.warn
  return PURPLE
}

function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

export default function MedicationsScreen() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const scanLock = useRef(false)

  const [form, setForm] = useState({
    name: '', quantity: '1', unit: 'comp.', dosisDesc: '', frecuenciaToma: '',
    notes: '', expiryDate: '', barcode: '', barcodeIsNew: false,
  })
  const [editForm, setEditForm] = useState<any>({})

  // Pharmacy modal
  const [showPharmacy, setShowPharmacy] = useState(false)
  const [pharmacyMode, setPharmacyMode] = useState<'restock' | 'sigre'>('restock')
  const [cp, setCp] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['medications'],
    queryFn: () => api.get<{ items: Medication[]; lowStockCount: number; expiringSoonCount: number; expiredCount: number }>('/medications'),
    refetchInterval: 60000,
  })

  const items = data?.items ?? []
  const lowStockCount = data?.lowStockCount ?? 0
  const expiringSoonCount = data?.expiringSoonCount ?? 0
  const expiredCount = data?.expiredCount ?? 0

  const expiredMeds = items.filter(i => i.expired).map(i => i.name)

  const sorted = [...items].sort((a, b) => {
    const score = (m: Medication) => m.expired ? 3 : m.expiringSoon ? 2 : m.lowStock ? 1 : 0
    return score(b) - score(a)
  })

  const pharmacyQuery = useQuery({
    queryKey: ['pharmacies', cp],
    queryFn: () => api.get<{ pharmacies: Pharmacy[]; mapsUrl: string }>(`/pharmacies?cp=${cp}`),
    enabled: /^\d{5}$/.test(cp),
    staleTime: 60 * 60 * 1000,
  })

  const add = useMutation({
    mutationFn: async () => {
      const res = await api.post('/medications', {
        name: form.name,
        quantity: Number(form.quantity) || 1,
        unit: form.unit,
        dosisDesc: form.dosisDesc || undefined,
        frecuenciaToma: form.frecuenciaToma || undefined,
        notes: form.notes || undefined,
        expiryDate: form.expiryDate || undefined,
        barcode: form.barcode || undefined,
      })
      if (form.barcodeIsNew && form.barcode) {
        await api.post('/product/contribute', { barcode: form.barcode, name: form.name, categoryId: 'MEDICAMENTOS' }).catch(() => {})
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] })
      setForm({ name: '', quantity: '1', unit: 'comp.', dosisDesc: '', frecuenciaToma: '', notes: '', expiryDate: '', barcode: '', barcodeIsNew: false })
      setShowForm(false)
      setShowScanner(false)
    },
  })

  const consume = useMutation({
    mutationFn: (m: Medication) => api.patch(`/medications/${m.id}`, { quantity: Math.max(0, m.quantity - 1) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  })

  const restock = useMutation({
    mutationFn: (m: Medication) => api.patch(`/medications/${m.id}`, { quantity: m.quantity + 20 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.delete(`/medications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] })
      setExpandedId(null)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/medications/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] })
      setEditingId(null)
    },
  })

  const confirmDelete = (m: Medication) => {
    Alert.alert('Eliminar medicamento', `¿Eliminar "${m.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => discard.mutate(m.id) },
    ])
  }

  const onScan = async (code: string) => {
    if (scanLock.current) return
    scanLock.current = true
    try {
      const res: any = await api.get(`/product/${code}`).catch(() => null)
      if (res?.name) {
        setForm(f => ({ ...f, name: res.name, barcode: code, barcodeIsNew: false }))
      } else {
        setForm(f => ({ ...f, barcode: code, barcodeIsNew: true }))
      }
      setShowScanner(false)
      setShowForm(true)
    } finally {
      setTimeout(() => { scanLock.current = false }, 1200)
    }
  }

  const openPharmacy = (mode: 'restock' | 'sigre') => {
    setPharmacyMode(mode)
    setShowPharmacy(true)
  }

  const startEdit = (m: Medication) => {
    setEditingId(m.id)
    setEditForm({
      name: m.name, quantity: String(m.quantity), unit: m.unit,
      dosisDesc: m.dosisDesc ?? '', frecuenciaToma: m.frecuenciaToma ?? '',
      notes: m.notes ?? '', expiryDate: m.expiryDate ? m.expiryDate.slice(0, 10) : '',
    })
  }

  const saveEdit = (id: string) => {
    update.mutate({
      id, payload: {
        name: editForm.name,
        quantity: Number(editForm.quantity) || 0,
        unit: editForm.unit,
        dosisDesc: editForm.dosisDesc || null,
        frecuenciaToma: editForm.frecuenciaToma || null,
        notes: editForm.notes || null,
        expiryDate: editForm.expiryDate || null,
      }
    })
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScreenHeader
          title="Medicamentos"
          subtitle={`${items.length} medicamento${items.length === 1 ? '' : 's'}${expiredCount ? ` · ${expiredCount} caducado${expiredCount === 1 ? '' : 's'}` : ''}${expiringSoonCount ? ` · ${expiringSoonCount} por caducar` : ''}${lowStockCount ? ` · ${lowStockCount} stock bajo` : ''}`}
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: PURPLE }]} onPress={() => { setShowScanner(s => !s); setShowForm(false) }}>
            <Text style={[styles.actionBtnText, { color: PURPLE }]}>📷 Escanear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: PURPLE }]} onPress={() => { setShowForm(s => !s); setShowScanner(false) }}>
            <Text style={[styles.actionBtnText, { color: PURPLE }]}>＋ Añadir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.border }]} onPress={() => openPharmacy('restock')}>
            <Text style={styles.actionBtnText}>📍 Farmacias</Text>
          </TouchableOpacity>
          {expiredCount > 0 && (
            <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.danger }]} onPress={() => openPharmacy('sigre')}>
              <Text style={[styles.actionBtnText, { color: theme.danger }]}>♻️ Llevar al SIGRE</Text>
            </TouchableOpacity>
          )}
        </View>

        {showScanner && (
          <Section title="Escanear medicamento">
            {!permission?.granted ? (
              <TouchableOpacity style={[ui.primaryBtn, { backgroundColor: PURPLE, marginHorizontal: 0 }]} onPress={requestPermission}>
                <Text style={ui.primaryBtnText}>Permitir cámara</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.cameraBox}>
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                  onBarcodeScanned={(r) => onScan(r.data)}
                />
              </View>
            )}
          </Section>
        )}

        {showForm && (
          <Section title="Nuevo medicamento">
            <Text style={ui.fieldLabel}>Nombre</Text>
            <TextInput style={ui.input} value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))}
              placeholder="Ibuprofeno 600mg" placeholderTextColor={theme.muted} />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Cantidad</Text>
                <TextInput style={ui.input} value={form.quantity} onChangeText={t => setForm(f => ({ ...f, quantity: t }))}
                  keyboardType="numeric" placeholderTextColor={theme.muted} />
              </View>
            </View>

            <Text style={ui.fieldLabel}>Unidad</Text>
            <View style={styles.pillsRow}>
              {UNIT_OPTS.map(u => (
                <Pill key={u} label={u} active={form.unit === u} onPress={() => setForm(f => ({ ...f, unit: u }))} color={PURPLE} />
              ))}
            </View>

            <Text style={ui.fieldLabel}>Dosis</Text>
            <TextInput style={ui.input} value={form.dosisDesc} onChangeText={t => setForm(f => ({ ...f, dosisDesc: t }))}
              placeholder="1 comprimido cada 8 horas" placeholderTextColor={theme.muted} />

            <Text style={ui.fieldLabel}>Frecuencia</Text>
            <View style={styles.pillsRow}>
              {FRECUENCIA_OPTS.map(f => (
                <Pill key={f} label={FRECUENCIA_LABELS[f]} active={form.frecuenciaToma === f} onPress={() => setForm(s => ({ ...s, frecuenciaToma: f }))} color={PURPLE} />
              ))}
            </View>

            <Text style={ui.fieldLabel}>Fecha de caducidad</Text>
            <TextInput style={ui.input} value={form.expiryDate} onChangeText={t => setForm(f => ({ ...f, expiryDate: t }))}
              placeholder="AAAA-MM-DD" placeholderTextColor={theme.muted} />

            <Text style={ui.fieldLabel}>Notas</Text>
            <TextInput style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]} value={form.notes} onChangeText={t => setForm(f => ({ ...f, notes: t }))}
              multiline placeholder="Notas adicionales" placeholderTextColor={theme.muted} />

            <TouchableOpacity
              style={[ui.primaryBtn, { backgroundColor: PURPLE, marginHorizontal: 0, opacity: form.name ? 1 : 0.5 }]}
              disabled={!form.name || add.isPending}
              onPress={() => add.mutate()}
            >
              {add.isPending ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </Section>
        )}

        {isLoading ? (
          <ActivityIndicator color={PURPLE} style={{ marginTop: 40 }} />
        ) : sorted.length === 0 ? (
          <EmptyState icon="🩺" title="Sin medicamentos registrados" desc="Añade tu primer medicamento o escanea su código de barras" />
        ) : (
          sorted.map(m => {
            const expanded = expandedId === m.id
            const editing = editingId === m.id
            const eLabel = expiryLabel(m.daysUntilExpiry)
            return (
              <View key={m.id} style={[ui.card, (m.expired || m.expiringSoon) && { borderColor: m.expired ? theme.danger : theme.warn }]}>
                <TouchableOpacity onPress={() => setExpandedId(expanded ? null : m.id)}>
                  <View style={ui.row}>
                    <Text style={styles.name}>🩺 {m.name}</Text>
                    <View style={styles.actionsCol}>
                      {m.expired ? (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openPharmacy('sigre')}>
                          <Text style={styles.iconBtnText}>♻️</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => consume.mutate(m)}>
                          <Text style={styles.iconBtnText}>−</Text>
                        </TouchableOpacity>
                      )}
                      {m.lowStock ? (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openPharmacy('restock')}>
                          <Text style={styles.iconBtnText}>📍</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.iconBtn} onPress={() => restock.mutate(m)}>
                          <Text style={styles.iconBtnText}>+</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.badgesRow}>
                    {m.expired && <View style={[styles.badge, { backgroundColor: theme.danger + '22' }]}><Text style={[styles.badgeText, { color: theme.danger }]}>Caducado</Text></View>}
                    {!m.expired && m.expiringSoon && <View style={[styles.badge, { backgroundColor: theme.warn + '22' }]}><Text style={[styles.badgeText, { color: theme.warn }]}>Caduca pronto</Text></View>}
                    {m.lowStock && <View style={[styles.badge, { backgroundColor: theme.danger + '22' }]}><Text style={[styles.badgeText, { color: theme.danger }]}>Stock bajo</Text></View>}
                    {m.frecuenciaToma && <View style={[styles.badge, { backgroundColor: PURPLE + '22' }]}><Text style={[styles.badgeText, { color: PURPLE }]}>{FRECUENCIA_LABELS[m.frecuenciaToma] ?? m.frecuenciaToma}</Text></View>}
                  </View>

                  {m.dosisDesc ? <Text style={styles.dosis}>{m.dosisDesc}</Text> : null}
                  {eLabel ? <Text style={[styles.dosis, { color: m.expired ? theme.danger : m.expiringSoon ? theme.warn : theme.muted }]}>{eLabel}</Text> : null}

                  <View style={styles.stockTrack}>
                    <View style={[styles.stockFill, { width: `${Math.min(100, (m.quantity / 20) * 100)}%`, backgroundColor: stockColor(m.quantity) }]} />
                  </View>
                  <Text style={styles.stockText}>{m.quantity} {m.unit}</Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.expanded}>
                    {editing ? (
                      <>
                        <Text style={ui.fieldLabel}>Nombre</Text>
                        <TextInput style={ui.input} value={editForm.name} onChangeText={t => setEditForm((f: any) => ({ ...f, name: t }))} placeholderTextColor={theme.muted} />
                        <Text style={ui.fieldLabel}>Cantidad</Text>
                        <TextInput style={ui.input} value={editForm.quantity} onChangeText={t => setEditForm((f: any) => ({ ...f, quantity: t }))} keyboardType="numeric" placeholderTextColor={theme.muted} />
                        <Text style={ui.fieldLabel}>Dosis</Text>
                        <TextInput style={ui.input} value={editForm.dosisDesc} onChangeText={t => setEditForm((f: any) => ({ ...f, dosisDesc: t }))} placeholderTextColor={theme.muted} />
                        <Text style={ui.fieldLabel}>Frecuencia</Text>
                        <View style={styles.pillsRow}>
                          {FRECUENCIA_OPTS.map(f => (
                            <Pill key={f} label={FRECUENCIA_LABELS[f]} active={editForm.frecuenciaToma === f} onPress={() => setEditForm((s: any) => ({ ...s, frecuenciaToma: f }))} color={PURPLE} />
                          ))}
                        </View>
                        <Text style={ui.fieldLabel}>Fecha de caducidad</Text>
                        <TextInput style={ui.input} value={editForm.expiryDate} onChangeText={t => setEditForm((f: any) => ({ ...f, expiryDate: t }))} placeholder="AAAA-MM-DD" placeholderTextColor={theme.muted} />
                        <Text style={ui.fieldLabel}>Notas</Text>
                        <TextInput style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]} value={editForm.notes} onChangeText={t => setEditForm((f: any) => ({ ...f, notes: t }))} multiline placeholderTextColor={theme.muted} />
                        <View style={styles.row2}>
                          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: PURPLE }]} onPress={() => saveEdit(m.id)}>
                            <Text style={styles.smallBtnText}>Guardar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.smallBtn, styles.smallBtnSec]} onPress={() => setEditingId(null)}>
                            <Text style={[styles.smallBtnText, { color: theme.text }]}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        {m.notes ? <Text style={styles.notes}>{m.notes}</Text> : null}
                        <View style={styles.row2}>
                          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: PURPLE }]} onPress={() => startEdit(m)}>
                            <Text style={styles.smallBtnText}>Editar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => confirmDelete(m)}>
                            <Text style={styles.smallBtnText}>Eliminar</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      <Modal visible={showPharmacy} animationType="slide" transparent onRequestClose={() => setShowPharmacy(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={ui.row}>
              <Text style={styles.modalTitle}>{pharmacyMode === 'sigre' ? 'Llevar al SIGRE' : 'Farmacias cercanas'}</Text>
              <TouchableOpacity onPress={() => setShowPharmacy(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {pharmacyMode === 'sigre' && (
              <View style={styles.sigreBox}>
                <Text style={styles.sigreText}>
                  Deposita los medicamentos caducados en el contenedor SIGRE (naranja) de tu farmacia.
                </Text>
                {expiredMeds.length > 0 && (
                  <Text style={styles.sigreList}>{expiredMeds.join(', ')}</Text>
                )}
              </View>
            )}

            <Text style={ui.fieldLabel}>Código postal</Text>
            <TextInput
              style={ui.input}
              value={cp}
              onChangeText={setCp}
              placeholder="28001"
              keyboardType="numeric"
              maxLength={5}
              placeholderTextColor={theme.muted}
            />

            <ScrollView style={{ maxHeight: 320 }}>
              {pharmacyQuery.isLoading && /^\d{5}$/.test(cp) ? (
                <ActivityIndicator color={PURPLE} style={{ marginTop: 20 }} />
              ) : pharmacyQuery.data?.pharmacies?.length ? (
                pharmacyQuery.data.pharmacies.map(p => (
                  <View key={p.id} style={styles.pharmacyCard}>
                    <Text style={styles.pharmacyName}>{p.name}</Text>
                    <Text style={styles.pharmacyMeta}>{p.address}</Text>
                    <Text style={styles.pharmacyMeta}>{fmtDistance(p.distance)}{p.openingHours ? ` · ${p.openingHours}` : ''}</Text>
                    <View style={styles.row2}>
                      {p.phone && (
                        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnSec]} onPress={() => Linking.openURL(`tel:${p.phone}`)}>
                          <Text style={[styles.smallBtnText, { color: theme.text }]}>📞 Llamar</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: PURPLE }]} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`)}>
                        <Text style={styles.smallBtnText}>🧭 Ir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : /^\d{5}$/.test(cp) ? (
                <Text style={styles.sigreText}>No se encontraron farmacias cercanas.</Text>
              ) : (
                <Text style={styles.sigreText}>Introduce tu código postal para buscar farmacias cercanas.</Text>
              )}

              {pharmacyQuery.data?.mapsUrl && (
                <TouchableOpacity onPress={() => Linking.openURL(pharmacyQuery.data!.mapsUrl)}>
                  <Text style={styles.mapsLink}>Ver todas en Google Maps</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  actionBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  actionBtnText: { color: theme.text, fontSize: 13, fontWeight: '700' },

  row2: { flexDirection: 'row', gap: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },

  cameraBox: { height: 280, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },

  name: { color: theme.text, fontSize: 16, fontWeight: '800', flex: 1 },
  actionsCol: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { color: theme.text, fontSize: 16, fontWeight: '800' },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  dosis: { color: theme.muted, fontSize: 13, marginTop: 6 },

  stockTrack: { height: 6, borderRadius: 3, backgroundColor: theme.border, marginTop: 10, overflow: 'hidden' },
  stockFill: { height: 6, borderRadius: 3 },
  stockText: { color: theme.muted, fontSize: 12, marginTop: 4 },

  expanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  notes: { color: theme.muted, fontSize: 13, marginBottom: 10 },

  smallBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  smallBtnSec: { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border },
  smallBtnDanger: { backgroundColor: theme.danger },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  modalClose: { color: theme.muted, fontSize: 20, fontWeight: '700' },

  sigreBox: { backgroundColor: PURPLE + '15', borderRadius: 12, padding: 12, marginBottom: 12 },
  sigreText: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  sigreList: { color: theme.text, fontSize: 13, fontWeight: '700', marginTop: 6 },

  pharmacyCard: { backgroundColor: theme.bg, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 10 },
  pharmacyName: { color: theme.text, fontSize: 14, fontWeight: '800' },
  pharmacyMeta: { color: theme.muted, fontSize: 12, marginTop: 2, marginBottom: 8 },

  mapsLink: { color: PURPLE, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8, marginBottom: 20 },
})
