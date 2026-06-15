import { useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, EmptyState, CollapsedAdd, styles as ui } from '@/components/ui'

const WINE = '#7F77DD'

interface WineItem {
  id: string
  name: string
  quantity: number
  unit: string
  bodega: string | null
  varietal: string | null
  anada: number | null
  denominacion: string | null
  valoracion: number | null
  notasCata: string | null
}

interface OFFProduct { product_name?: string; brands?: string }

interface EditState {
  bodega: string
  varietal: string
  anada: string
  denominacion: string
  valoracion: number
  notasCata: string
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange(value === n ? 0 : n)} accessibilityLabel={`${n} estrellas`}>
          <Text style={{ fontSize: 26, color: n <= value ? WINE : theme.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function ratingStars(v: number | null) {
  if (!v) return null
  const full = Math.round(v)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

export default function WineScreen() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showLabelCam, setShowLabelCam] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()
  const scanLock = useRef(false)
  const camRef = useRef<any>(null)
  const [labelLoading, setLabelLoading] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, EditState>>({})

  // Formulario de alta
  const [fName, setFName] = useState('')
  const [fBarcode, setFBarcode] = useState('')
  const [fBodega, setFBodega] = useState('')
  const [fVarietal, setFVarietal] = useState('')
  const [fAnada, setFAnada] = useState('')
  const [fDenominacion, setFDenominacion] = useState('')
  const [fValoracion, setFValoracion] = useState(0)
  const [fNotas, setFNotas] = useState('')
  const [fQty, setFQty] = useState('1')

  const { data, isLoading } = useQuery<WineItem[]>({
    queryKey: ['wine'],
    queryFn: () => api.get(`/items?categoryId=wine&sort=createdAt&order=desc&limit=100`),
  })
  const items = data ?? []

  const rated = items.filter(i => i.valoracion)
  const avgRating = rated.length ? rated.reduce((s, i) => s + (i.valoracion ?? 0), 0) / rated.length : 0
  const bodegas = new Set(items.map(i => i.bodega).filter(Boolean)).size
  const totalBotellas = items.reduce((s, i) => s + i.quantity, 0)

  const discardItem = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wine'] }),
  })

  const addItem = useMutation({
    mutationFn: () => api.post('/items', {
      name: fName,
      barcode: fBarcode.trim() || undefined,
      categoryId: 'wine',
      quantity: parseFloat(fQty) || 1,
      unit: 'botella',
      bodega: fBodega.trim() || undefined,
      varietal: fVarietal.trim() || undefined,
      anada: fAnada.trim() ? parseInt(fAnada, 10) : undefined,
      denominacion: fDenominacion.trim() || undefined,
      valoracion: fValoracion > 0 ? fValoracion : undefined,
      notasCata: fNotas.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wine'] })
      setShowForm(false)
      resetForm()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'No se pudo añadir el vino'
      Alert.alert('Error', message)
    },
  })

  const updateItem = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/items/${id}`, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['wine'] })
      setExpandedId(null)
      setEditing(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la ficha'
      Alert.alert('Error', message)
    },
  })

  function resetForm() {
    setFName(''); setFBarcode(''); setFBodega(''); setFVarietal(''); setFAnada('')
    setFDenominacion(''); setFValoracion(0); setFNotas(''); setFQty('1')
  }

  function startEdit(item: WineItem) {
    setExpandedId(item.id)
    setEditing(prev => ({
      ...prev,
      [item.id]: {
        bodega: item.bodega ?? '',
        varietal: item.varietal ?? '',
        anada: item.anada ? String(item.anada) : '',
        denominacion: item.denominacion ?? '',
        valoracion: item.valoracion ?? 0,
        notasCata: item.notasCata ?? '',
      },
    }))
  }

  function setEditField<K extends keyof EditState>(id: string, key: K, value: EditState[K]) {
    setEditing(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function saveEdit(id: string) {
    const edit = editing[id]
    if (!edit) return
    updateItem.mutate({
      id,
      body: {
        bodega: edit.bodega.trim() || undefined,
        varietal: edit.varietal.trim() || undefined,
        anada: edit.anada.trim() ? parseInt(edit.anada, 10) : undefined,
        denominacion: edit.denominacion.trim() || undefined,
        valoracion: edit.valoracion > 0 ? edit.valoracion : undefined,
        notasCata: edit.notasCata.trim() || undefined,
      },
    })
  }

  const confirmDiscard = (item: WineItem) => {
    Alert.alert('Descartar vino', `¿Descartar "${item.name}"?`, [
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
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`)
      const json = await res.json()
      const p: OFFProduct = json.product ?? {}
      if (p.product_name) setFName(p.brands ? `${p.product_name} (${p.brands})` : p.product_name)
      setFBarcode(code)
    } catch {
      setFBarcode(code)
    } finally {
      setTimeout(() => { scanLock.current = false }, 1500)
    }
  }

  const capturePhoto = async () => {
    if (!camRef.current) return
    setLabelLoading(true)
    try {
      const photo = await camRef.current.takePictureAsync({ base64: true, quality: 0.5 })
      if (!photo?.base64) throw new Error('No se pudo capturar la foto')
      const d = await api.post<any>('/ocr/wine-label', { image: photo.base64, mediaType: 'image/jpeg' })
      setShowLabelCam(false)
      setShowForm(true)
      if (d?.name) setFName(d.name)
      if (d?.bodega) setFBodega(d.bodega)
      if (d?.varietal) setFVarietal(d.varietal)
      if (d?.anada) setFAnada(String(d.anada))
      if (d?.denominacion) setFDenominacion(d.denominacion)
      if (!d?.name && !d?.bodega && !d?.varietal) {
        Alert.alert('Sin resultados', 'No se han podido leer datos de la etiqueta. Puedes rellenar los campos manualmente.')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo procesar la etiqueta'
      Alert.alert('Error', message)
    } finally {
      setLabelLoading(false)
    }
  }

  return (
    <View style={ui.screen}>
      <ScreenHeader title="🍷 Bodega y vinos" subtitle="Ficha, valoración y notas de cata de tus vinos" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          {[
            { label: 'Botellas', value: totalBotellas, color: WINE },
            { label: 'Vinos', value: items.length, color: theme.teal },
            { label: 'Bodegas', value: bodegas, color: theme.brand },
            { label: 'Valoración media', value: avgRating ? avgRating.toFixed(1) : '—', color: theme.warn },
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
            onPress={async () => { if (!permission?.granted) await requestPermission(); setShowLabelCam(false); setShowScanner(v => !v) }}
          >
            <Text style={styles.actionBtnText}>📦 {showScanner ? 'Cerrar' : 'Escanear'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            onPress={async () => { if (!permission?.granted) await requestPermission(); setShowScanner(false); setShowLabelCam(v => !v) }}
          >
            <Text style={styles.actionBtnText}>🏷️ {showLabelCam ? 'Cerrar' : 'Etiqueta'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: WINE, borderColor: WINE }]} onPress={() => setShowForm(v => !v)}>
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
            <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center', padding: 10 }}>Centra el código de barras de la botella en la cámara</Text>
          </View>
        )}

        {showLabelCam && (
          <View style={[ui.card, { padding: 0, overflow: 'hidden' }]}>
            {permission?.granted ? (
              <CameraView ref={camRef} style={{ width: '100%', height: 280 }} />
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 13 }}>Se necesita acceso a la cámara</Text></View>
            )}
            <View style={{ padding: 10 }}>
              <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>Encuadra la etiqueta de la botella y haz la foto</Text>
              <TouchableOpacity
                style={[ui.primaryBtn, { marginHorizontal: 0, marginTop: 0, backgroundColor: WINE }, labelLoading && { opacity: 0.6 }]}
                disabled={labelLoading || !permission?.granted}
                onPress={capturePhoto}
              >
                {labelLoading ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>📸 Reconocer etiqueta</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showForm ? (
          <Section title="Nuevo vino">
            <Text style={ui.fieldLabel}>Código de barras (opcional)</Text>
            <TextInput value={fBarcode} onChangeText={setFBarcode} placeholder="ej. 8410000012345" placeholderTextColor={theme.muted} keyboardType="numeric" style={ui.input} />

            <Text style={ui.fieldLabel}>Nombre del vino *</Text>
            <TextInput value={fName} onChangeText={setFName} placeholder="ej. Viña Pomal Crianza" placeholderTextColor={theme.muted} style={ui.input} />

            <Text style={ui.fieldLabel}>Bodega</Text>
            <TextInput value={fBodega} onChangeText={setFBodega} placeholder="ej. Bodegas Bilbaínas" placeholderTextColor={theme.muted} style={ui.input} />

            <Text style={ui.fieldLabel}>Variedad / Varietal</Text>
            <TextInput value={fVarietal} onChangeText={setFVarietal} placeholder="ej. Tempranillo, Garnacha" placeholderTextColor={theme.muted} style={ui.input} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Añada</Text>
                <TextInput value={fAnada} onChangeText={setFAnada} placeholder="2021" placeholderTextColor={theme.muted} keyboardType="numeric" style={ui.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>D.O.</Text>
                <TextInput value={fDenominacion} onChangeText={setFDenominacion} placeholder="ej. Rioja" placeholderTextColor={theme.muted} style={ui.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.fieldLabel}>Botellas</Text>
                <TextInput value={fQty} onChangeText={setFQty} keyboardType="numeric" style={ui.input} />
              </View>
            </View>

            <Text style={ui.fieldLabel}>Valoración</Text>
            <StarPicker value={fValoracion} onChange={setFValoracion} />

            <Text style={ui.fieldLabel}>Notas de cata (opcional)</Text>
            <TextInput
              value={fNotas} onChangeText={setFNotas} placeholder="Color, aroma, sabor, maridaje..." placeholderTextColor={theme.muted}
              multiline style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[ui.primaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0, backgroundColor: WINE }, (!fName.trim() || addItem.isPending) && { opacity: 0.5 }]}
                disabled={!fName.trim() || addItem.isPending}
                onPress={() => addItem.mutate()}
              >
                {addItem.isPending ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar vino</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[ui.secondaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }]} onPress={() => { setShowForm(false); resetForm() }}>
                <Text style={ui.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Section>
        ) : (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <CollapsedAdd label="Añadir vino" onPress={() => setShowForm(true)} />
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={WINE} style={{ marginTop: 30 }} />
        ) : items.length === 0 ? (
          <EmptyState icon="🍷" title="Sin vinos en tu bodega" desc="Añade un vino escaneando la botella, haciendo una foto de la etiqueta o a mano" />
        ) : (
          items.map(item => {
            const isExpanded = expandedId === item.id
            const edit = editing[item.id]
            const stars = ratingStars(item.valoracion)
            return (
              <View key={item.id} style={ui.card}>
                <TouchableOpacity onPress={() => (isExpanded ? setExpandedId(null) : startEdit(item))}>
                  <View style={[ui.row, { marginBottom: 4 }]}>
                    <Text style={styles.name}>🍷 {item.name}</Text>
                    {stars ? <Text style={styles.rating}>{stars}</Text> : null}
                  </View>
                  <Text style={styles.meta}>
                    {[item.bodega, item.varietal, item.anada ? String(item.anada) : null, item.denominacion].filter(Boolean).join(' · ')
                      || 'Sin ficha completada — toca para añadir bodega, añada, varietal...'}
                  </Text>
                  {!isExpanded && item.notasCata ? <Text style={styles.notes}>{item.notasCata}</Text> : null}
                </TouchableOpacity>

                {isExpanded && edit && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={ui.fieldLabel}>Bodega</Text>
                    <TextInput value={edit.bodega} onChangeText={v => setEditField(item.id, 'bodega', v)} placeholder="ej. Bodegas Muga" placeholderTextColor={theme.muted} style={ui.input} />

                    <Text style={ui.fieldLabel}>Variedad / Varietal</Text>
                    <TextInput value={edit.varietal} onChangeText={v => setEditField(item.id, 'varietal', v)} placeholder="ej. Tempranillo, Garnacha" placeholderTextColor={theme.muted} style={ui.input} />

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={ui.fieldLabel}>Añada</Text>
                        <TextInput value={edit.anada} onChangeText={v => setEditField(item.id, 'anada', v)} placeholder="2021" placeholderTextColor={theme.muted} keyboardType="numeric" style={ui.input} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={ui.fieldLabel}>D.O.</Text>
                        <TextInput value={edit.denominacion} onChangeText={v => setEditField(item.id, 'denominacion', v)} placeholder="ej. Rioja" placeholderTextColor={theme.muted} style={ui.input} />
                      </View>
                    </View>

                    <Text style={ui.fieldLabel}>Valoración</Text>
                    <StarPicker value={edit.valoracion} onChange={v => setEditField(item.id, 'valoracion', v)} />

                    <Text style={ui.fieldLabel}>Notas de cata</Text>
                    <TextInput
                      value={edit.notasCata} onChangeText={v => setEditField(item.id, 'notasCata', v)} placeholder="Color, aroma, sabor, maridaje..." placeholderTextColor={theme.muted}
                      multiline style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    />

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: WINE, flex: 2 }]} disabled={updateItem.isPending} onPress={() => saveEdit(item.id)}>
                        {updateItem.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Guardar ficha</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: theme.bg, flex: 1 }]} onPress={() => confirmDiscard(item)} disabled={discardItem.isPending}>
                        <Text style={{ color: theme.muted, fontWeight: '700', fontSize: 12 }}>Descartar</Text>
                      </TouchableOpacity>
                    </View>
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
  actionBtnText: { color: theme.text, fontWeight: '700', fontSize: 13 },
  name: { color: theme.text, fontSize: 15, fontWeight: '700' },
  rating: { color: WINE, fontSize: 13 },
  meta: { color: theme.muted, fontSize: 12 },
  notes: { color: theme.muted, fontSize: 12, fontStyle: 'italic', marginTop: 6 },
  smallBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
})
