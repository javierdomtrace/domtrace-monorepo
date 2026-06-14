import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, Pill, EmptyState, styles as ui } from '@/components/ui'

interface Zone { id: string; name: string; icon: string }
interface Suggestion {
  zonaSugerida: string
  zoneId?: string | null
  isFresco: boolean
  tipoFresco?: string | null
  vidaUtilDias?: number | null
  conservacion?: string | null
  consolidarCon?: string | null
  stoqlyTip?: string | null
}
interface QueueItem {
  tempId: string
  barcode?: string
  name: string
  quantity: number
  unit: string
  suggestion?: Suggestion
  zoneId?: string
  expiryDate?: string
  lotNumber?: string
  action: 'new' | 'consolidate' | 'skip'
  saving?: boolean
}

const TIPOS_FRESCOS_LABEL: Record<string, string> = {
  TUBERCULO: 'Tubérculos', RAIZ: 'Raíces', HOJA: 'Verduras de hoja',
  TOMATE: 'Tomates', ALLIUM: 'Cebollas/Ajos', FRUTA_CLIM: 'Fruta climatérica',
  FRUTA_NO_CLIM: 'Fruta no climatérica', CITRICO: 'Cítricos', HIERBA: 'Hierbas aromáticas',
}

function uid() { return Math.random().toString(36).slice(2) }

async function lookupOFF(barcode: string): Promise<{ name: string } | null> {
  try {
    const data = await api.get<any>(`/openfoodfacts/${barcode}`)
    return data?.name ? { name: data.name } : null
  } catch { return null }
}

export default function ReceiveScreen() {
  const qc = useQueryClient()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [stoqlyMsg, setStoqlyMsg] = useState('')
  const [scanMode, setScanMode] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const scanLock = useRef(false)
  const [permission, requestPermission] = useCameraPermissions()

  const { data: zonesData } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => api.get('/pantry/zones'),
  })
  const { data: pantryData } = useQuery<any>({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?limit=100'),
  })

  const zones = zonesData ?? []
  const pantryItems: any[] = Array.isArray(pantryData) ? pantryData : (pantryData?.data ?? [])

  const addByBarcode = useCallback(async (code: string) => {
    const clean = code.replace(/\D/g, '')
    if (!clean || clean.length < 8) return
    setBarcodeInput('')
    const tempId = uid()
    setQueue(q => [...q, { tempId, barcode: clean, name: 'Buscando...', quantity: 1, unit: 'u', action: 'new' }])
    const info = await lookupOFF(clean)
    const finalName = info?.name ?? `Producto ${clean}`
    setQueue(q => q.map(item => item.tempId === tempId ? { ...item, name: finalName } : item))
  }, [])

  const addByName = useCallback(() => {
    const name = nameInput.trim()
    if (!name) return
    setQueue(q => [...q, { tempId: uid(), name, quantity: 1, unit: 'u', action: 'new' }])
    setNameInput('')
  }, [nameInput])

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanLock.current) return
    scanLock.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    addByBarcode(data)
    setTimeout(() => { scanLock.current = false }, 1500)
  }

  const analyzeWithStoqly = async () => {
    if (queue.length === 0) return
    setAnalyzing(true)
    setStoqlyMsg('')
    try {
      const listaProductos = queue.map((item, i) => `${i}. ${item.name}${item.barcode ? ` (EAN: ${item.barcode})` : ''}`).join('\n')
      const listaDespensa = pantryItems.slice(0, 20).map(i => `- ${i.name} (${i.quantity}${i.unit})`).join('\n')
      const listaZonas = zones.map(z => `${z.icon} ${z.name} (id: ${z.id})`).join(', ')

      const prompt = `Acabo de llegar del supermercado con estos ${queue.length} productos:
${listaProductos}

Mi despensa actual tiene: ${listaDespensa || 'nada todavía'}

Zonas disponibles: ${listaZonas || 'ninguna configurada'}

Para CADA producto (por su índice numérico exacto del 0 al ${queue.length - 1}), devuelve una sugerencia. Responde ÚNICAMENTE con JSON:
{
  "mensajeGeneral": "frase de bienvenida de Stoqly viendo la compra, con humor si procede",
  "items": [
    {
      "idx": 0,
      "zonaSugerida": "nombre de la zona donde guardarlo (nevera, despensa, congelador...)",
      "zoneId": "id de la zona de la lista de zonas disponibles, o null",
      "isFresco": false,
      "tipoFresco": null,
      "vidaUtilDias": null,
      "conservacion": "consejo de conservación en 1 frase o null",
      "consolidarCon": "nombre del producto en la despensa actual si ya lo tienes, o null",
      "stoqlyTip": "tip gracioso o útil en 1 frase o null"
    }
  ]
}`
      const res = await api.post<any>('/stoqly/chat', { message: prompt, history: [], maxTokens: 2000 })
      const text = res.reply ?? ''
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text.trim()
      const parsed = JSON.parse(jsonStr)

      if (parsed.mensajeGeneral) setStoqlyMsg(parsed.mensajeGeneral)
      if (parsed.items) {
        setQueue(q => q.map((item, idx) => {
          const sug = parsed.items.find((s: any) => s.idx === idx)
          if (!sug) return item
          return { ...item, suggestion: sug, zoneId: sug.zoneId ?? item.zoneId, action: sug.consolidarCon ? 'consolidate' : 'new' }
        }))
      }
    } catch (e) {
      console.error('Error análisis Stoqly:', e)
      Alert.alert('Stoqly', 'No se pudo analizar la compra ahora mismo.')
    } finally {
      setAnalyzing(false)
    }
  }

  const saveItem = useCallback(async (item: QueueItem) => {
    if (item.saving || item.action === 'skip') return
    setQueue(q => q.map(qi => qi.tempId === item.tempId ? { ...qi, saving: true } : qi))
    try {
      const sug = item.suggestion
      await api.post('/items', {
        name: item.name,
        barcode: item.barcode,
        quantity: item.quantity,
        unit: item.unit,
        zoneId: item.zoneId || undefined,
        lotNumber: item.lotNumber || undefined,
        ...(sug?.isFresco ? {
          fechaCompra: new Date().toISOString(),
          tipoFresco: sug.tipoFresco ?? undefined,
          vidaUtilDias: sug.vidaUtilDias ?? undefined,
          conservacion: sug.conservacion ?? undefined,
        } : {
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : undefined,
        }),
      })
      setQueue(q => q.filter(qi => qi.tempId !== item.tempId))
    } catch (e) {
      console.error('Error guardando', item.name, e)
      setQueue(q => q.map(qi => qi.tempId === item.tempId ? { ...qi, saving: false } : qi))
      Alert.alert('Error', `No se pudo guardar ${item.name}`)
    }
  }, [])

  const saveAll = async () => {
    const toSave = queue.filter(i => !i.saving && i.action !== 'skip')
    if (toSave.length === 0) return
    setSaving(true)
    for (const item of toSave) {
      await saveItem(item)
      await new Promise(r => setTimeout(r, 120))
    }
    qc.invalidateQueries({ queryKey: ['pantry-summary'] })
    qc.invalidateQueries({ queryKey: ['items'] })
    setSaving(false)
  }

  const pendingCount = queue.filter(i => !i.saving && i.action !== 'skip').length

  return (
    <View style={ui.screen}>
      <ScreenHeader title="📥 Recibir compra" subtitle="Escanea o añade productos — Stoqly los coloca en la despensa" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Cámara */}
        <Section title="Escanear">
          <TouchableOpacity
            style={[styles.scanBtn, scanMode && styles.scanBtnActive]}
            onPress={() => {
              if (!permission?.granted) { requestPermission(); return }
              setScanMode(v => !v)
            }}
          >
            <Text style={[styles.scanBtnText, scanMode && { color: theme.teal }]}>
              {scanMode ? '✕ Cerrar cámara' : '📷 Abrir cámara'}
            </Text>
          </TouchableOpacity>

          {scanMode && permission?.granted && (
            <View style={styles.cameraWrap}>
              <CameraView
                style={{ width: '100%', height: 220 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr'] }}
                onBarcodeScanned={handleBarcode}
              />
              <View style={styles.cameraHint}>
                <Text style={styles.cameraHintText}>Cada código añade un producto a la cola</Text>
              </View>
            </View>
          )}

          {/* Inputs manuales */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TextInput
              value={barcodeInput}
              onChangeText={t => setBarcodeInput(t.replace(/\D/g, ''))}
              placeholder="Código EAN..."
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={[ui.input, { flex: 1, marginBottom: 0 }]}
              onSubmitEditing={() => addByBarcode(barcodeInput)}
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => addByBarcode(barcodeInput)}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Añadir por nombre..."
              placeholderTextColor={theme.muted}
              style={[ui.input, { flex: 1, marginBottom: 0 }]}
              onSubmitEditing={addByName}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addByName}>
              <Text style={styles.addBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* Mensaje Stoqly */}
        {stoqlyMsg ? (
          <View style={[ui.card, styles.stoqlyMsg]}>
            <Text style={styles.stoqlyIcon}>✦</Text>
            <Text style={styles.stoqlyMsgText}>{stoqlyMsg}</Text>
          </View>
        ) : null}

        {/* Cola */}
        {queue.length === 0 ? (
          <EmptyState icon="🛍️" title="Escanea el primer producto" desc="Usa la cámara o escribe el nombre" />
        ) : (
          <>
            <View style={[ui.row, { marginHorizontal: 20, marginBottom: 8 }]}>
              <Text style={styles.queueCount}>{queue.length} producto{queue.length > 1 ? 's' : ''} en cola</Text>
              <TouchableOpacity onPress={() => setQueue([])}>
                <Text style={styles.clearQueue}>🗑 Vaciar</Text>
              </TouchableOpacity>
            </View>

            {queue.map(item => (
              <QueueCard
                key={item.tempId}
                item={item}
                zones={zones}
                expanded={expanded === item.tempId}
                onToggle={() => setExpanded(expanded === item.tempId ? null : item.tempId)}
                onUpdate={patch => setQueue(q => q.map(qi => qi.tempId === item.tempId ? { ...qi, ...patch } : qi))}
                onRemove={() => setQueue(q => q.filter(qi => qi.tempId !== item.tempId))}
                onSave={() => saveItem(item)}
              />
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.analyzeBtn]}
                disabled={analyzing}
                onPress={analyzeWithStoqly}
              >
                {analyzing
                  ? <ActivityIndicator color={theme.brand} size="small" />
                  : <Text style={styles.analyzeBtnText}>✦ Analizar con Stoqly</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveAllBtn, (saving || pendingCount === 0) && { opacity: 0.4 }]}
                disabled={saving || pendingCount === 0}
                onPress={saveAll}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveAllBtnText}>📦 Guardar {pendingCount}</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function QueueCard({ item, zones, expanded, onToggle, onUpdate, onRemove, onSave }: {
  item: QueueItem; zones: Zone[]
  expanded: boolean; onToggle: () => void
  onUpdate: (patch: Partial<QueueItem>) => void
  onRemove: () => void
  onSave: () => void
}) {
  const sug = item.suggestion
  const isFresco = sug?.isFresco
  const skipped = item.action === 'skip'

  return (
    <View style={[styles.queueCard, skipped && { opacity: 0.4 }, isFresco && { borderColor: '#3B6D11' }]}>
      <View style={styles.queueRow}>
        <View style={[styles.queueIcon, isFresco && { backgroundColor: 'rgba(59,109,17,0.15)' }]}>
          <Text style={{ fontSize: 16 }}>{item.saving ? '⏳' : isFresco ? '🌱' : '📦'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.queueName} numberOfLines={1}>{item.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {sug?.zonaSugerida ? <Text style={styles.tagTeal}>📍 {sug.zonaSugerida}</Text> : null}
            {sug?.consolidarCon ? <Text style={styles.tagWarn}>⚠️ Ya tienes: {sug.consolidarCon}</Text> : null}
            {isFresco && sug?.tipoFresco ? <Text style={styles.tagGreen}>🌱 {TIPOS_FRESCOS_LABEL[sug.tipoFresco] ?? sug.tipoFresco}</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {!item.saving && !skipped && (
            <TouchableOpacity style={styles.saveOneBtn} onPress={onSave}>
              <Text style={styles.saveOneBtnText}>✓ Guardar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onUpdate({ action: skipped ? 'new' : 'skip' })} style={styles.iconBtn}>
            <Text style={{ color: skipped ? theme.teal : theme.muted, fontSize: 14 }}>{skipped ? '✓' : '✕'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggle} style={styles.iconBtn}>
            <Text style={{ color: theme.muted, fontSize: 14 }}>{expanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={styles.iconBtn}>
            <Text style={{ color: theme.muted, fontSize: 14 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sug?.stoqlyTip && !expanded ? <Text style={styles.tipText}>💬 {sug.stoqlyTip}</Text> : null}

      {expanded && (
        <View style={styles.expandedPanel}>
          {isFresco && sug?.conservacion ? (
            <View style={styles.conservBox}>
              <Text style={styles.conservTitle}>🌱 Conservación{sug.vidaUtilDias ? ` — ~${sug.vidaUtilDias} días` : ''}</Text>
              <Text style={styles.conservDesc}>{sug.conservacion}</Text>
            </View>
          ) : null}

          <Text style={ui.fieldLabel}>Zona</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <Pill label="Sin zona" active={!item.zoneId} onPress={() => onUpdate({ zoneId: undefined })} />
            {zones.map(z => (
              <Pill key={z.id} label={`${z.icon} ${z.name}`} active={item.zoneId === z.id} onPress={() => onUpdate({ zoneId: z.id })} />
            ))}
          </View>

          <Text style={ui.fieldLabel}>Cantidad</Text>
          <TextInput
            value={String(item.quantity)}
            onChangeText={t => onUpdate({ quantity: parseFloat(t.replace(',', '.')) || 1 })}
            keyboardType="numeric"
            style={[ui.input, { marginBottom: 10 }]}
          />

          {!isFresco && (
            <>
              <Text style={ui.fieldLabel}>Fecha de caducidad (AAAA-MM-DD, opcional)</Text>
              <TextInput
                value={item.expiryDate ?? ''}
                onChangeText={t => onUpdate({ expiryDate: t })}
                placeholder="2026-12-31"
                placeholderTextColor={theme.muted}
                style={[ui.input, { marginBottom: 10 }]}
              />
            </>
          )}

          <Text style={ui.fieldLabel}>Lote (opcional)</Text>
          <TextInput
            value={item.lotNumber ?? ''}
            onChangeText={t => onUpdate({ lotNumber: t })}
            placeholder="Ej: L240612A"
            placeholderTextColor={theme.muted}
            style={[ui.input, { marginBottom: 10 }]}
          />

          {sug?.consolidarCon ? (
            <>
              <Text style={ui.fieldLabel}>¿Qué hacer? Ya tienes "{sug.consolidarCon}"</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pill label="📦 Añadir al existente" active={item.action === 'consolidate'} onPress={() => onUpdate({ action: 'consolidate' })} color={theme.warn} />
                <Pill label="➕ Entrada nueva" active={item.action === 'new'} onPress={() => onUpdate({ action: 'new' })} color={theme.teal} />
              </View>
            </>
          ) : null}

          {sug?.stoqlyTip ? <Text style={[styles.tipText, { marginTop: 10 }]}>💬 {sug.stoqlyTip}</Text> : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  scanBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  scanBtnActive: { borderColor: theme.teal, backgroundColor: 'rgba(78,205,196,0.1)' },
  scanBtnText: { color: theme.muted, fontWeight: '700', fontSize: 14 },
  cameraWrap: { marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.teal },
  cameraHint: { padding: 8, backgroundColor: 'rgba(78,205,196,0.08)' },
  cameraHintText: { color: theme.muted, fontSize: 11, textAlign: 'center' },
  addBtn: { backgroundColor: theme.teal, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#0F0F1A', fontSize: 20, fontWeight: '700' },
  stoqlyMsg: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(29,158,117,0.07)', borderColor: 'rgba(29,158,117,0.2)' },
  stoqlyIcon: { color: theme.brand, fontSize: 16 },
  stoqlyMsgText: { color: theme.text, fontSize: 13, flex: 1, lineHeight: 18 },
  queueCount: { color: theme.muted, fontSize: 13, fontWeight: '700' },
  clearQueue: { color: theme.muted, fontSize: 12 },
  queueCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, marginHorizontal: 20, marginBottom: 8, overflow: 'hidden' },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  queueIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(78,205,196,0.08)', alignItems: 'center', justifyContent: 'center' },
  queueName: { color: theme.text, fontSize: 14, fontWeight: '600' },
  tagTeal: { color: theme.teal, fontSize: 11 },
  tagWarn: { color: theme.warn, fontSize: 11 },
  tagGreen: { color: '#3B6D11', fontSize: 11 },
  iconBtn: { padding: 4 },
  saveOneBtn: { backgroundColor: theme.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  saveOneBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tipText: { color: theme.muted, fontSize: 12, fontStyle: 'italic', paddingHorizontal: 12, paddingBottom: 10 },
  expandedPanel: { padding: 12, borderTopWidth: 1, borderTopColor: theme.border },
  conservBox: { padding: 10, backgroundColor: 'rgba(59,109,17,0.08)', borderWidth: 1, borderColor: 'rgba(59,109,17,0.2)', borderRadius: 8, marginBottom: 10 },
  conservTitle: { color: '#3B6D11', fontSize: 12, fontWeight: '700', marginBottom: 3 },
  conservDesc: { color: theme.muted, fontSize: 12 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  analyzeBtn: { borderWidth: 1, borderColor: 'rgba(29,158,117,0.4)', backgroundColor: 'rgba(29,158,117,0.08)' },
  analyzeBtnText: { color: theme.brand, fontSize: 14, fontWeight: '700' },
  saveAllBtn: { backgroundColor: theme.brand },
  saveAllBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
