import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, Pill, EmptyState, CollapsedAdd, styles as ui } from '@/components/ui'

const PURPLE = '#C084FC'

interface CosmeticTip { momento: string; frecuencia: string; consejo: string; evitar: string | null }
interface CosmeticItem {
  id: string; name: string; categoryId: string | null; openedAt: string | null
  paoMonths: number | null; quantity: number; unit: string; notes: string | null; status: string
}

const CATEGORIES = [
  { id: 'all', label: '✨ Todos' },
  { id: 'face', label: '🌸 Rostro' },
  { id: 'body', label: '💧 Cuerpo' },
  { id: 'hair', label: '💨 Cabello' },
  { id: 'makeup', label: '🎨 Maquillaje' },
  { id: 'other', label: '📦 Otros' },
]
const PAO_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36]

function calcPAO(item: CosmeticItem): { pct: number; daysLeft: number; status: 'unopened' | 'ok' | 'warning' | 'expired' } {
  if (!item.openedAt || !item.paoMonths) return { pct: 0, daysLeft: -1, status: 'unopened' }
  const openedMs = new Date(item.openedAt).getTime()
  const totalDays = item.paoMonths * 30
  const elapsed = Math.floor((Date.now() - openedMs) / 86400000)
  const pct = Math.min(Math.round((elapsed / totalDays) * 100), 100)
  const daysLeft = totalDays - elapsed
  let status: 'ok' | 'warning' | 'expired' = 'ok'
  if (elapsed >= totalDays) status = 'expired'
  else if (pct >= 75) status = 'warning'
  return { pct, daysLeft, status }
}
function paoColor(status: string) {
  if (status === 'expired') return theme.danger
  if (status === 'warning') return theme.warn
  if (status === 'ok') return theme.teal
  return theme.border
}
function categoryLabel(id: string | null) {
  return CATEGORIES.find(c => c.id === id)?.label.replace(/^\S+\s/, '') ?? 'Otros'
}

export default function CosmeticsScreen() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const scanLock = useRef(false)
  const [tips, setTips] = useState<Record<string, { tip?: CosmeticTip; loading: boolean }>>({})

  const [fName, setFName] = useState('')
  const [fBarcode, setFBarcode] = useState('')
  const [fCategory, setFCategory] = useState('face')
  const [fPao, setFPao] = useState(12)
  const [fQty, setFQty] = useState('1')
  const [fUnit, setFUnit] = useState('u')
  const [fNotes, setFNotes] = useState('')

  const { data, isLoading } = useQuery<CosmeticItem[]>({
    queryKey: ['cosmetics', activeTab],
    queryFn: () => {
      const params: Record<string, string> = { sort: 'openedAt', order: 'asc', limit: '100' }
      if (activeTab === 'all') params.categoryIds = 'face,body,hair,makeup,other'
      else params.categoryId = activeTab
      const qs = new URLSearchParams(params).toString()
      return api.get(`/items?${qs}`)
    },
  })
  const items = data ?? []

  const summary = {
    total: items.length,
    opened: items.filter(i => i.openedAt).length,
    warning: items.filter(i => calcPAO(i).status === 'warning').length,
    expired: items.filter(i => calcPAO(i).status === 'expired').length,
  }

  const fetchTip = async (item: CosmeticItem) => {
    if (tips[item.id]?.tip || tips[item.id]?.loading) return
    setTips(prev => ({ ...prev, [item.id]: { loading: true } }))
    try {
      const params = new URLSearchParams({ name: item.name })
      if (item.categoryId) params.set('category', item.categoryId)
      const res = await api.get<any>(`/stoqly/cosmetic-tip?${params}`)
      setTips(prev => ({ ...prev, [item.id]: { loading: false, tip: res?.data ?? res } }))
    } catch {
      setTips(prev => ({ ...prev, [item.id]: { loading: false } }))
    }
  }

  const openItem = useMutation({
    mutationFn: (item: CosmeticItem) => api.patch(`/items/${item.id}/open`, {}),
    onSuccess: (_d, item) => { qc.invalidateQueries({ queryKey: ['cosmetics'] }); fetchTip(item) },
  })
  const discardItem = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cosmetics'] }),
  })
  const addItem = useMutation({
    mutationFn: () => api.post('/items', {
      name: fName,
      barcode: fBarcode.trim() || undefined,
      categoryId: fCategory,
      paoMonths: fPao,
      quantity: parseFloat(fQty) || 1,
      unit: fUnit,
      notes: fNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cosmetics'] })
      setShowForm(false)
      setFName(''); setFBarcode(''); setFCategory('face'); setFPao(12); setFQty('1'); setFUnit('u'); setFNotes('')
    },
  })

  const confirmDiscard = (item: CosmeticItem) => {
    Alert.alert('Descartar producto', `¿Descartar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => discardItem.mutate(item.id) },
    ])
  }

  const onScan = async (code: string) => {
    if (scanLock.current) return
    scanLock.current = true
    setShowScanner(false)
    setShowForm(true)
    try {
      const prod = await api.get<any>(`/product/${code}`)
      if (prod?.name) {
        setFName(prod.brand ? `${prod.name} (${prod.brand})` : prod.name)
        if (prod.categoryId) setFCategory(prod.categoryId)
        if (prod.paoMonths) setFPao(prod.paoMonths)
        if (prod.ingredients) setFNotes(String(prod.ingredients).slice(0, 200))
      }
      setFBarcode(code)
    } catch {
      setFBarcode(code)
    } finally {
      setTimeout(() => { scanLock.current = false }, 1500)
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="✨ Belleza e Higiene" subtitle="Controla la vida útil de tus cosméticos" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: summary.total, color: PURPLE },
            { label: 'Abiertos', value: summary.opened, color: theme.teal },
            { label: 'Aviso', value: summary.warning, color: theme.warn },
            { label: 'Caducados', value: summary.expired, color: theme.danger },
          ].map(c => (
            <View key={c.label} style={[styles.statCard, { borderColor: c.color + '33', backgroundColor: c.color + '14' }]}>
              <Text style={[styles.statValue, { color: c.color }]}>{c.value}</Text>
              <Text style={styles.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 14 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            onPress={async () => { if (!permission?.granted) await requestPermission(); setShowScanner(v => !v) }}
          >
            <Text style={styles.actionBtnText}>📷 {showScanner ? 'Cerrar cámara' : 'Escanear'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: PURPLE, borderColor: PURPLE }]} onPress={() => setShowForm(v => !v)}>
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>＋ Añadir</Text>
          </TouchableOpacity>
        </View>

        {showScanner && (
          <View style={[ui.card, { padding: 0, overflow: 'hidden' }]}>
            {permission?.granted ? (
              <CameraView style={{ width: '100%', height: 240 }} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'datamatrix'] }} onBarcodeScanned={(res) => onScan(res.data)} />
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 13 }}>Se necesita acceso a la cámara</Text></View>
            )}
            <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Centra el código de barras en la cámara</Text>
          </View>
        )}

        {showForm ? (
          <Section title="Nuevo cosmético">
            <Text style={ui.fieldLabel}>Código de barras (opcional)</Text>
            <TextInput value={fBarcode} onChangeText={setFBarcode} placeholder="ej. 3600523688463" placeholderTextColor={theme.muted} keyboardType="numeric" style={ui.input} />

            <Text style={ui.fieldLabel}>Nombre del producto *</Text>
            <TextInput value={fName} onChangeText={setFName} placeholder="ej. Crema hidratante Neutrogena" placeholderTextColor={theme.muted} style={ui.input} />

            <Text style={ui.fieldLabel}>Categoría</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <Pill key={c.id} label={c.label} active={fCategory === c.id} onPress={() => setFCategory(c.id)} color={PURPLE} />
              ))}
            </View>

            <Text style={ui.fieldLabel}>PAO — vida útil tras apertura</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PAO_OPTIONS.map(m => (
                <Pill key={m} label={`${m} ${m === 1 ? 'mes' : 'meses'}`} active={fPao === m} onPress={() => setFPao(m)} color={PURPLE} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Cantidad</Text>
                <TextInput value={fQty} onChangeText={setFQty} keyboardType="numeric" style={ui.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Unidad</Text>
                <TextInput value={fUnit} onChangeText={setFUnit} placeholder="u" placeholderTextColor={theme.muted} style={ui.input} />
              </View>
            </View>

            <Text style={ui.fieldLabel}>Notas (opcional)</Text>
            <TextInput value={fNotes} onChangeText={setFNotes} placeholder="ej. Para uso nocturno, piel seca" placeholderTextColor={theme.muted} style={ui.input} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[ui.primaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0, backgroundColor: PURPLE }, (!fName.trim() || addItem.isPending) && { opacity: 0.5 }]}
                disabled={!fName.trim() || addItem.isPending}
                onPress={() => addItem.mutate()}
              >
                {addItem.isPending ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar producto</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[ui.secondaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }]} onPress={() => setShowForm(false)}>
                <Text style={ui.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Section>
        ) : (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <CollapsedAdd label="Añadir cosmético" onPress={() => setShowForm(true)} />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 6, marginBottom: 14 }}>
          {CATEGORIES.map(c => (
            <Pill key={c.id} label={c.label} active={activeTab === c.id} onPress={() => setActiveTab(c.id)} color={PURPLE} />
          ))}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={PURPLE} style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <EmptyState icon="✨" title="Sin productos en esta categoría" desc="Añade un cosmético para empezar a controlar su vida útil" />
        ) : (
          items.map(item => {
            const pao = calcPAO(item)
            const color = paoColor(pao.status)
            const tip = tips[item.id]
            return (
              <View key={item.id} style={[ui.card, pao.status === 'expired' && { borderColor: theme.danger + '55' }, pao.status === 'warning' && { borderColor: theme.warn + '55' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {pao.status === 'expired' && <Text style={[styles.badge, { backgroundColor: theme.danger, color: '#fff' }]}>CADUCADO</Text>}
                  {pao.status === 'warning' && <Text style={[styles.badge, { backgroundColor: theme.warn, color: '#fff' }]}>AVISAR</Text>}
                </View>
                <Text style={styles.meta}>
                  {categoryLabel(item.categoryId)} · {item.quantity} {item.unit}{item.paoMonths ? ` · PAO ${item.paoMonths}M` : ''}
                  {item.openedAt ? ` · Abierto ${new Date(item.openedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </Text>

                {item.paoMonths ? (
                  pao.status === 'unopened' ? (
                    <Text style={styles.unopened}>Sin abrir — {item.paoMonths} {item.paoMonths === 1 ? 'mes' : 'meses'} de vida tras apertura</Text>
                  ) : (
                    <View style={{ marginTop: 4 }}>
                      <View style={[ui.row, { marginBottom: 4 }]}>
                        <Text style={{ fontSize: 11, color }}>{pao.pct}% consumido</Text>
                        <Text style={{ fontSize: 11, color: theme.muted }}>{pao.status === 'expired' ? `Caducado hace ${Math.abs(pao.daysLeft)} días` : `${pao.daysLeft} días restantes`}</Text>
                      </View>
                      <View style={styles.paoTrack}><View style={[styles.paoFill, { width: `${pao.pct}%`, backgroundColor: color }]} /></View>
                    </View>
                  )
                ) : (
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>Sin fecha PAO configurada</Text>
                )}

                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {!item.openedAt && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: 'rgba(78,205,196,0.12)' }]} onPress={() => openItem.mutate(item)} disabled={openItem.isPending}>
                      <Text style={{ color: theme.teal, fontWeight: '700', fontSize: 12 }}>Abrir hoy</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: tip?.tip ? 'rgba(192,132,252,0.12)' : theme.bg }]} onPress={() => fetchTip(item)} disabled={tip?.loading}>
                    <Text style={{ color: PURPLE, fontWeight: '700', fontSize: 12 }}>{tip?.loading ? '…' : '✨ Consejo'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.bg }]} onPress={() => confirmDiscard(item)} disabled={discardItem.isPending}>
                    <Text style={{ color: theme.muted, fontWeight: '700', fontSize: 12 }}>Descartar</Text>
                  </TouchableOpacity>
                </View>

                {tip?.tip && (
                  <View style={styles.tipBox}>
                    <View style={[ui.row, { marginBottom: 6 }]}>
                      <Text style={{ color: PURPLE, fontSize: 12, fontWeight: '700' }}>✨ Consejo de Vicky</Text>
                      <Text style={styles.tipMomento}>{tip.tip.momento}</Text>
                    </View>
                    <Text style={styles.tipText}>{tip.tip.consejo}</Text>
                    <Text style={styles.tipMeta}>📅 {tip.tip.frecuencia}{tip.tip.evitar ? `  ·  ⚠️ ${tip.tip.evitar}` : ''}</Text>
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginBottom: 14 },
  statCard: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, color: theme.muted, marginTop: 2 },
  actionBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.surface },
  actionBtnText: { color: theme.text, fontWeight: '700', fontSize: 14 },
  name: { color: theme.text, fontSize: 15, fontWeight: '700' },
  meta: { color: theme.muted, fontSize: 12, marginBottom: 8 },
  badge: { fontSize: 10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontWeight: '700' },
  unopened: { color: theme.teal, fontSize: 12, backgroundColor: 'rgba(78,205,196,0.08)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
  paoTrack: { height: 6, backgroundColor: theme.bg, borderRadius: 3, overflow: 'hidden' },
  paoFill: { height: '100%', borderRadius: 3 },
  notes: { color: theme.muted, fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  smallBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tipBox: { marginTop: 12, padding: 12, backgroundColor: 'rgba(192,132,252,0.07)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)', borderRadius: 10 },
  tipMomento: { fontSize: 11, color: PURPLE, backgroundColor: 'rgba(192,132,252,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tipText: { color: theme.text, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  tipMeta: { color: theme.muted, fontSize: 11 },
})
