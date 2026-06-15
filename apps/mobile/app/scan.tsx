import { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { parseGS1, type GS1Data } from '@/lib/gs1'

interface OFFProduct { product_name?: string; brands?: string; allergens_tags?: string[] }

export default function ScanScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [manualEan, setManualEan] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualExtra, setManualExtra] = useState<GS1Data | null>(null)

  const add = useMutation({
    mutationFn: (body: { name: string; quantity: number; unit: string; allergens?: string[]; barcode?: string; lotNumber?: string; expiryDate?: string }) =>
      api.post('/items', {
        ...body,
        // El backend espera datetime ISO completo; el GS1/AI(17) solo da una fecha (yyyy-mm-dd)
        expiryDate: body.expiryDate ? new Date(body.expiryDate).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry-summary'] })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert('✓ Añadido', 'Producto añadido a la despensa', [
        { text: 'Seguir escaneando', onPress: () => setScanned(false) },
        { text: 'Ir a despensa', onPress: () => router.replace('/(tabs)') },
      ])
    },
    onError: (err: unknown) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      const message = err instanceof Error ? err.message : 'No se pudo añadir el producto'
      Alert.alert('Error al añadir', message, [
        { text: 'Reintentar', onPress: () => setScanned(false) },
      ])
    },
  })

  const lookupAndAdd = async (barcode: string, gs1?: GS1Data) => {
    setLookingUp(true)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
      const json = await res.json()
      const p: OFFProduct = json.product ?? {}
      const name = p.product_name || p.brands
      const allergens = (p.allergens_tags ?? []).map((a: string) => a.replace('en:', '').toUpperCase())

      if (!name) {
        // OFF respondió pero no tiene datos del producto: no inventamos un
        // nombre como "Producto {ean}" — se lo pedimos al usuario.
        Alert.alert(
          'Producto no identificado',
          `Código: ${barcode}\n¿Cómo se llama este producto?`,
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => setScanned(false) },
            { text: 'Ponerle nombre', onPress: () => { setShowManual(true); setManualEan(barcode); setManualExtra(gs1 ?? null) } },
          ]
        )
        return
      }

      Alert.alert(
        name,
        allergens.length > 0 ? `Alérgenos: ${allergens.join(', ')}` : 'Sin alérgenos detectados',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setScanned(false) },
          {
            text: 'Añadir a despensa',
            onPress: () => add.mutate({
              name, quantity: 1, unit: 'u', allergens, barcode,
              lotNumber: gs1?.lotNumber, expiryDate: gs1?.expiryDate,
            }),
          },
        ]
      )
    } catch {
      Alert.alert(
        'Producto no encontrado',
        `Código: ${barcode}\n¿Cómo se llama este producto?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => setScanned(false) },
          { text: 'Añadir', onPress: () => { setShowManual(true); setManualEan(barcode); setManualExtra(gs1 ?? null) } },
        ]
      )
    } finally { setLookingUp(false) }
  }

  const handleBarcode = ({ data }: { data: string }) => {
    if (scanned || lookingUp) return
    setScanned(true)
    // Feedback inmediato de que se ha detectado el código (vibración).
    // .catch para que un fallo del haptic (p.ej. dispositivo sin motor de vibración)
    // no bloquee el flujo de añadir el producto.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})

    // Si es un GS1 DataMatrix/QR (GTIN + lote + caducidad...), lo extraemos
    // y usamos el GTIN para la búsqueda; si no, tratamos `data` como EAN/UPC.
    const gs1 = parseGS1(data)
    if (!gs1 && !/^\d+$/.test(data)) {
      // QR que no es ni GS1 ni un código numérico (p.ej. una URL): no es un
      // producto de despensa que sepamos interpretar.
      Alert.alert('Código no reconocido', 'Este código QR no corresponde a un producto de despensa.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ])
      return
    }
    const code = gs1?.ean ?? gs1?.gtin ?? data
    lookupAndAdd(code, gs1 ?? undefined)
  }

  if (!permission) return <View style={styles.screen} />

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>📷</Text>
        <Text style={styles.permTitle}>Necesito la cámara</Text>
        <Text style={styles.permSub}>Para escanear códigos de barras de tus productos</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (showManual) {
    return (
      <ManualEntry
        ean={manualEan}
        extra={manualExtra}
        looking={lookingUp}
        onAdd={(name) => {
          setShowManual(false)
          add.mutate({
            name, quantity: 1, unit: 'u',
            barcode: manualEan || undefined,
            lotNumber: manualExtra?.lotNumber,
            expiryDate: manualExtra?.expiryDate,
          })
        }}
        onLookup={(code) => { setShowManual(false); lookupAndAdd(code) }}
        onCancel={() => { setShowManual(false); setScanned(false); setManualExtra(null) }}
      />
    )
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr', 'datamatrix'] }}
        onBarcodeScanned={handleBarcode}
      />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayBottom} />
        <View style={[styles.overlaySide, { left: 0 }]} />
        <View style={[styles.overlaySide, { right: 0 }]} />

        {/* Viewfinder */}
        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            {[
              { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
              { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
              { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
              { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
            ].map((s, i) => (
              <View key={i} style={[styles.corner, s as any]} />
            ))}
          </View>
        </View>
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Escanear producto</Text>
        <TouchableOpacity onPress={() => setShowManual(true)} style={styles.manualBtn}>
          <Text style={styles.manualBtnText}>Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom hint */}
      <View style={styles.bottomHint}>
        {lookingUp ? (
          <View style={styles.lookingUp}>
            <ActivityIndicator color={theme.brand} size="small" />
            <Text style={styles.lookingUpText}>Buscando producto...</Text>
          </View>
        ) : (
          <Text style={styles.hintText}>Apunta al código de barras</Text>
        )}
      </View>
    </View>
  )
}

function ManualEntry({ ean, extra, onAdd, onCancel, onLookup, looking }: {
  ean: string
  extra?: GS1Data | null
  onAdd: (name: string) => void
  onCancel: () => void
  onLookup: (ean: string) => void
  looking: boolean
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  return (
    <View style={styles.manualScreen}>
      <Text style={styles.manualTitle}>Añadir producto</Text>
      {ean ? <Text style={styles.manualEan}>Código: {ean} — no identificado en la base de datos</Text> : null}
      {extra?.lotNumber || extra?.expiryDate ? (
        <Text style={styles.manualEan}>
          {extra?.lotNumber ? `Lote detectado: ${extra.lotNumber}` : ''}
          {extra?.lotNumber && extra?.expiryDate ? '  ·  ' : ''}
          {extra?.expiryDate ? `Caduca: ${extra.expiryDate}` : ''}
        </Text>
      ) : null}

      {!ean && (
        <>
          <Text style={styles.manualLabel}>Código de barras (EAN)</Text>
          <TextInput
            style={styles.manualInput}
            placeholder="Ej: 8410000012345" placeholderTextColor={theme.muted}
            keyboardType="number-pad"
            value={code} onChangeText={setCode}
            returnKeyType="search" onSubmitEditing={() => code && onLookup(code)}
          />
          <TouchableOpacity
            onPress={() => code && onLookup(code)}
            disabled={!code || looking}
            style={[styles.confirmBtn, { marginBottom: 24, opacity: code && !looking ? 1 : 0.4 }]}
          >
            {looking
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.confirmBtnText}>Buscar producto</Text>}
          </TouchableOpacity>
          <Text style={[styles.manualLabel, { marginTop: 8 }]}>O añade manualmente sin código</Text>
        </>
      )}

      <Text style={styles.manualLabel}>Nombre del producto</Text>
      <TextInput
        style={styles.manualInput}
        placeholder="Ej: Vino Rioja 2021" placeholderTextColor={theme.muted}
        autoFocus={!!ean} value={name} onChangeText={setName}
        returnKeyType="done" onSubmitEditing={() => name && onAdd(name)}
      />
      <View style={styles.manualButtons}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => name && onAdd(name)} disabled={!name}
          style={[styles.confirmBtn, { opacity: name ? 1 : 0.4 }]}>
          <Text style={styles.confirmBtnText}>Añadir →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.55)'

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: theme.bg },
  permissionScreen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  permTitle:      { color: theme.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  permSub:        { color: theme.muted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permBtn:        { backgroundColor: theme.brand, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText:    { color: '#fff', fontWeight: '700' },
  cameraScreen:   { flex: 1, backgroundColor: '#000' },
  overlayTop:     { position: 'absolute', top: 0, left: 0, right: 0, height: '30%', backgroundColor: OVERLAY_COLOR },
  overlayBottom:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', backgroundColor: OVERLAY_COLOR },
  overlaySide:    { position: 'absolute', top: '30%', bottom: '35%', width: '10%', backgroundColor: OVERLAY_COLOR },
  viewfinderWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  viewfinder:     { width: '80%', aspectRatio: 1.8, borderWidth: 2, borderColor: theme.brand, borderRadius: 16 },
  corner:         { position: 'absolute', width: 24, height: 24, borderColor: theme.brand, borderRadius: 2 },
  topBar:         { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn:       { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:   { color: '#fff', fontSize: 18 },
  topBarTitle:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  manualBtn:      { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  manualBtnText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottomHint:     { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  lookingUp:      { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lookingUpText:  { color: '#fff', fontSize: 14 },
  hintText:       { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  manualScreen:   { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 24, justifyContent: 'center' },
  manualTitle:    { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  manualEan:      { color: theme.muted, fontSize: 14, marginBottom: 24 },
  manualLabel:    { color: theme.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  manualInput:    { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, fontSize: 16, marginBottom: 24 },
  manualButtons:  { flexDirection: 'row', gap: 12 },
  cancelBtn:      { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText:  { color: theme.muted, fontWeight: '600' },
  confirmBtn:     { flex: 2, backgroundColor: theme.brand, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
})
