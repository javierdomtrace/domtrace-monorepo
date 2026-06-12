import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ScanLine, Plus, Trash2, CheckCircle, RefreshCw, Package, Leaf, ChevronDown, ChevronUp, Camera } from 'lucide-react'
import { useA11y } from '../store/accessibility'
import { speak } from '../lib/tts'
import { vibrate } from '../lib/vibration'

// ── Tipos ────────────────────────────────────────────────────────────

interface QueueItem {
  tempId: string
  barcode?: string
  name: string
  quantity: number
  unit: string
  imageUrl?: string
  // Sugerencia de Stoqly
  suggestion?: {
    zonaSugerida: string
    zoneId?: string | null
    isFresco: boolean
    tipoFresco?: string | null
    vidaUtilDias?: number | null
    conservacion?: string | null
    consolidarCon?: string | null
    stoqlyTip?: string | null
  }
  // Decisión del usuario
  zoneId?: string
  expiryDate?: string
  lotNumber?: string
  fechaCompra?: string
  action: 'new' | 'consolidate' | 'skip'
  saving?: boolean   // en proceso de guardarse
  removing?: boolean // animación de salida en curso
}

interface Zone { id: string; name: string; icon: string }

const TIPOS_FRESCOS_LABEL: Record<string, string> = {
  TUBERCULO: 'Tubérculos', RAIZ: 'Raíces', HOJA: 'Verduras de hoja',
  TOMATE: 'Tomates', ALLIUM: 'Cebollas/Ajos', FRUTA_CLIM: 'Fruta climatérica',
  FRUTA_NO_CLIM: 'Fruta no climatérica', CITRICO: 'Cítricos', HIERBA: 'Hierbas aromáticas',
}

// ── Helpers ──────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

async function lookupOFF(barcode: string): Promise<{ name: string; imageUrl?: string } | null> {
  try {
    const data = await api.get<any>(`/openfoodfacts/${barcode}`)
    return data.name ? { name: data.name, imageUrl: data.imageUrl } : null
  } catch { return null }
}

// Lee un File como base64 (sin el prefijo "data:...;base64,")
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface LabelScanResult {
  expiryDate: string | null
  lotNumber: string | null
  confidence: 'alta' | 'media' | 'baja'
  notes: string | null
}

// Envía una foto de la etiqueta a Claude Vision para extraer fecha de caducidad y lote
async function scanLabel(file: File): Promise<LabelScanResult | null> {
  try {
    const image = await fileToBase64(file)
    const mediaType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    return await api.post<LabelScanResult>('/ocr/label-scan', { image, mediaType })
  } catch (e) {
    console.error('Error en OCR de etiqueta:', e)
    return null
  }
}

// ── Componente principal ─────────────────────────────────────────────

export function ReceivePage() {
  const qc = useQueryClient()
  const voiceFeedback = useA11y(s => s.voiceFeedback)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [stoqlyMsg, setStoqlyMsg] = useState('')
  const savedCountRef = useRef(0)
  const [scanMode, setScanMode] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<any>(null)

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

  // ── Añadir por barcode ────────────────────────────────────────────
  const addByBarcode = useCallback(async (code: string) => {
    const clean = code.replace(/\D/g, '')
    if (!clean || clean.length < 8) return
    setBarcodeInput('')
    const tempId = uid()
    // Añadir placeholder inmediatamente
    setQueue(q => [...q, {
      tempId, barcode: clean, name: `Buscando...`, quantity: 1, unit: 'u', action: 'new'
    }])
    const info = await lookupOFF(clean)
    const finalName = info?.name ?? `Producto ${clean}`
    setQueue(q => q.map(item =>
      item.tempId === tempId
        ? { ...item, name: finalName, imageUrl: info?.imageUrl }
        : item
    ))
    speak(info?.name ? `Producto detectado: ${finalName}` : `Código ${clean} no reconocido. Añadido como producto sin identificar.`, voiceFeedback)
    vibrate(info?.name ? 'ITEM_ADDED' : 'ALERT')
    barcodeRef.current?.focus()
  }, [voiceFeedback])

  // ── Añadir por nombre manual ──────────────────────────────────────
  const addByName = useCallback(() => {
    const name = nameInput.trim()
    if (!name) return
    setQueue(q => [...q, { tempId: uid(), name, quantity: 1, unit: 'u', action: 'new' }])
    setNameInput('')
  }, [nameInput])

  // ── Cámara (html5-qrcode) en modo continuo ────────────────────────
  useEffect(() => {
    if (!scanMode) return
    let stopped = false
    const SCAN_DIV = 'receive-scanner'

    async function startCamera() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(SCAN_DIV)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 260, height: 100 } },
          async (decoded: string) => {
            if (stopped) return
            await addByBarcode(decoded)
          },
          () => {}
        )
      } catch (e: any) {
        if (!stopped) setScanMode(false)
      }
    }
    startCamera()
    return () => {
      stopped = true
      scannerRef.current?.stop().catch(() => {})
    }
  }, [scanMode, addByBarcode])

  // ── Analizar lote con Stoqly ──────────────────────────────────────
  const analyzeWithStoqly = async () => {
    if (queue.length === 0) return
    setAnalyzing(true)
    setStoqlyMsg('')
    try {
      const listaProductos = queue
        .map((item, i) => `${i}. ${item.name}${item.barcode ? ` (EAN: ${item.barcode})` : ''}`)
        .join('\n')

      const listaDespensa = pantryItems
        .slice(0, 20)
        .map(i => `- ${i.name} (${i.quantity}${i.unit})`)
        .join('\n')

      const listaZonas = zones
        .map(z => `${z.icon} ${z.name} (id: ${z.id})`)
        .join(', ')

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

      const res = await api.post<any>('/stoqly/chat', {
        message: prompt, history: [], maxTokens: 2000
      })

      const text = res.reply ?? ''
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text.trim()
      const parsed = JSON.parse(jsonStr)

      if (parsed.mensajeGeneral) setStoqlyMsg(parsed.mensajeGeneral)
      if (parsed.items) {
        setQueue(q => q.map((item, idx) => {
          const sug = parsed.items.find((s: any) => s.idx === idx)
          if (!sug) return item
          return {
            ...item,
            suggestion: sug,
            zoneId: sug.zoneId ?? item.zoneId,
            action: sug.consolidarCon ? 'consolidate' : 'new',
          }
        }))
        // Expandir el primero con sugerencia de fresco
        const firstFresco = queue.findIndex((_, i) => parsed.items[i]?.isFresco)
        if (firstFresco >= 0) setExpanded(queue[firstFresco].tempId)
      }
    } catch (e) {
      console.error('Error análisis Stoqly:', e)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Guardar un item y animarlo fuera ─────────────────────────────
  const saveItem = useCallback(async (item: QueueItem) => {
    if (item.saving || item.removing || item.action === 'skip') return
    // Marcar como "guardando"
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
          fechaCompra: item.fechaCompra ?? new Date().toISOString(),
          tipoFresco: sug.tipoFresco ?? undefined,
          vidaUtilDias: sug.vidaUtilDias ?? undefined,
          conservacion: sug.conservacion ?? undefined,
        } : {
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : undefined,
        }),
      })
      savedCountRef.current += 1
      setSavedCount(savedCountRef.current)
      // Iniciar animación de salida
      setQueue(q => q.map(qi => qi.tempId === item.tempId ? { ...qi, saving: false, removing: true } : qi))
      // Tras la animación, eliminar del array
      setTimeout(() => {
        setQueue(q => q.filter(qi => qi.tempId !== item.tempId))
      }, 380)
    } catch (e) {
      console.error('Error guardando', item.name, e)
      setQueue(q => q.map(qi => qi.tempId === item.tempId ? { ...qi, saving: false } : qi))
    }
  }, [])

  // ── Guardar todo secuencialmente ─────────────────────────────────
  const saveAll = async () => {
    const toSave = queue.filter(i => !i.saving && !i.removing && i.action !== 'skip')
    if (toSave.length === 0) return
    setSaving(true)
    for (const item of toSave) {
      await saveItem(item)
      await new Promise(r => setTimeout(r, 120)) // pequeña pausa entre items
    }
    qc.invalidateQueries({ queryKey: ['items'] })
    qc.invalidateQueries({ queryKey: ['summary'] })
    setSaving(false)
  }

  const pendingCount = queue.filter(i => !i.saving && !i.removing && i.action !== 'skip').length
  const allDone = queue.length === 0 && savedCountRef.current > 0

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Package size={26} color="#1D9E75" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Recibir la compra</h1>
          <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Escanea o añade los productos — Stoqly los coloca en la despensa.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setScanMode(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 10, border: scanMode ? '1px solid var(--teal)' : '1px solid var(--border)',
            background: scanMode ? 'rgba(78,205,196,0.1)' : 'var(--surface)',
            color: scanMode ? 'var(--teal)' : 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Camera size={14} /> {scanMode ? 'Cerrar cámara' : 'Abrir cámara'}
          </button>
        </div>
      </div>

      {/* Cámara continua */}
      {scanMode && (
        <div style={{
          marginBottom: 16, borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--teal)', background: '#000',
        }}>
          <div id="receive-scanner" style={{ width: '100%' }} />
          <div style={{ padding: '8px 14px', background: 'rgba(78,205,196,0.06)', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            📷 Cámara activa — cada código añade un producto a la cola automáticamente
          </div>
        </div>
      )}

      {/* Input rápido */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
        padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      }}>
        {/* EAN */}
        <div>
          <label style={lbl}><ScanLine size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Código de barras EAN</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && addByBarcode(barcodeInput)}
              placeholder="8-14 dígitos o escáner USB..."
              inputMode="numeric"
              style={{ ...inp, marginBottom: 0, flex: 1 }}
            />
            <button onClick={() => addByBarcode(barcodeInput)} style={btnSmall} aria-label="Añadir por código de barras">+</button>
          </div>
        </div>
        {/* Nombre manual */}
        <div>
          <label style={lbl}><Plus size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Añadir por nombre</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addByName()}
              placeholder="Ej: Aceite de oliva..."
              style={{ ...inp, marginBottom: 0, flex: 1 }}
            />
            <button onClick={addByName} style={btnSmall} aria-label="Añadir por nombre">+</button>
          </div>
        </div>
      </div>

      {/* Mensaje Stoqly */}
      {stoqlyMsg && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16,
          padding: '12px 14px', background: 'rgba(29,158,117,0.07)',
          border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 }}>✦</div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{stoqlyMsg}</div>
        </div>
      )}

      {/* Cola de productos */}
      {queue.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🛍️</div>
          <p style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 6px', fontWeight: 600 }}>
            Escanea el primer producto
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>Usa el escáner USB, la cámara o escribe el nombre.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
              {queue.length} producto{queue.length > 1 ? 's' : ''} en cola
            </span>
            <button
              onClick={() => setQueue([])}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Trash2 size={12} /> Vaciar cola
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {queue.map((item) => (
              <QueueCard
                key={item.tempId}
                item={item}
                zones={zones}
                expanded={expanded === item.tempId}
                onToggle={() => setExpanded(expanded === item.tempId ? null : item.tempId)}
                onUpdate={(patch) => setQueue(q => q.map(qi => qi.tempId === item.tempId ? { ...qi, ...patch } : qi))}
                onRemove={() => setQueue(q => q.filter(qi => qi.tempId !== item.tempId))}
                onSave={() => saveItem(item)}
              />
            ))}
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={analyzeWithStoqly}
              disabled={analyzing}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px', borderRadius: 12, border: '1px solid rgba(29,158,117,0.4)',
                background: 'rgba(29,158,117,0.08)', color: '#1D9E75',
                fontSize: 14, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer',
              }}
            >
              {analyzing
                ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Stoqly analizando...</>
                : <>✦ Analizar con Stoqly</>
              }
            </button>
            <button
              onClick={saveAll}
              disabled={saving || pendingCount === 0}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px', borderRadius: 12, border: 'none',
                background: '#1D9E75', color: '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: (saving || pendingCount === 0) ? 'not-allowed' : 'pointer',
                opacity: pendingCount === 0 ? 0.4 : 1,
              }}
            >
              {saving
                ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                : <><Package size={16} /> Guardar {pendingCount} en la despensa</>
              }
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes queueExit {
          0%   { opacity: 1; transform: translateX(0); max-height: 200px; }
          40%  { opacity: 0.6; transform: translateX(6px); }
          100% { opacity: 0; transform: translateX(20px); max-height: 0; padding: 0; margin: 0; }
        }
        .queue-item-exit {
          animation: queueExit 0.38s ease-in forwards;
          pointer-events: none;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

// ── Tarjeta de item en la cola ────────────────────────────────────────

function QueueCard({ item, zones, expanded, onToggle, onUpdate, onRemove, onSave }: {
  item: QueueItem; zones: Zone[]
  expanded: boolean; onToggle: () => void
  onUpdate: (patch: Partial<QueueItem>) => void
  onRemove: () => void
  onSave: () => void
}) {
  const sug = item.suggestion
  const isFresco = sug?.isFresco
  const voiceFeedback = useA11y(s => s.voiceFeedback)
  const ocrInputRef = useRef<HTMLInputElement>(null)
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ocrResult, setOcrResult] = useState<LabelScanResult | null>(null)

  const handleLabelPhoto = async (file: File | undefined) => {
    if (!file) return
    setOcrStatus('loading')
    setOcrResult(null)
    const result = await scanLabel(file)
    if (!result) {
      setOcrStatus('error')
      speak('No se pudo analizar la foto de la etiqueta.', voiceFeedback)
      vibrate('ERROR')
      return
    }
    setOcrResult(result)
    setOcrStatus('done')
    const patch: Partial<QueueItem> = {}
    if (result.lotNumber) patch.lotNumber = result.lotNumber
    if (result.expiryDate && !isFresco) patch.expiryDate = result.expiryDate
    if (Object.keys(patch).length > 0) onUpdate(patch)

    // Anunciar el resultado por voz (accesibilidad)
    const partes: string[] = []
    if (result.expiryDate && !isFresco) {
      const [y, m, d] = result.expiryDate.split('-')
      partes.push(`caducidad ${d}/${m}/${y}`)
    }
    if (result.lotNumber) partes.push(`lote ${result.lotNumber}`)
    if (partes.length > 0) {
      const aviso = result.confidence === 'baja' ? ' Revisa los datos, la confianza es baja.' : ''
      speak(`Etiqueta analizada: ${partes.join(', ')}.${aviso}`, voiceFeedback)
      vibrate(result.confidence === 'baja' ? 'ALERT' : 'CONFIRM')
    } else {
      speak('No se ha encontrado fecha de caducidad ni lote en la foto.', voiceFeedback)
      vibrate('ALERT')
    }
  }

  const borderColor = item.removing
    ? '#1D9E75'
    : item.saving
      ? 'rgba(29,158,117,0.5)'
      : item.action === 'skip'
        ? 'var(--border)'
        : isFresco
          ? '#3B6D11'
          : 'var(--border)'

  return (
    <div
      className={item.removing ? 'queue-item-exit' : ''}
      style={{
        background: 'var(--surface)', border: `1px solid ${borderColor}`,
        borderRadius: 12, overflow: 'hidden',
        opacity: item.action === 'skip' ? 0.4 : 1,
        transition: 'border-color 0.2s, opacity 0.2s',
      }}
    >
      {/* Fila principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        {/* Icono */}
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: item.removing ? 'rgba(29,158,117,0.2)' : isFresco ? 'rgba(59,109,17,0.15)' : 'rgba(78,205,196,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {item.removing ? '✅' : item.saving ? <RefreshCw size={18} color="#1D9E75" style={{ animation: 'spin 1s linear infinite' }} /> : isFresco ? '🌱' : item.imageUrl ? <img src={item.imageUrl} alt={`Foto de ${item.name}`} style={{ width: 30, height: 30, objectFit: 'contain' }} /> : '📦'}
        </div>

        {/* Nombre + zona sugerida */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {sug?.zonaSugerida && (
              <span style={{ color: 'var(--teal)' }}>📍 {sug.zonaSugerida}</span>
            )}
            {sug?.consolidarCon && (
              <span style={{ color: '#EF9F27' }}>⚠️ Ya tienes: {sug.consolidarCon}</span>
            )}
            {isFresco && sug?.tipoFresco && (
              <span style={{ color: '#3B6D11' }}>🌱 {TIPOS_FRESCOS_LABEL[sug.tipoFresco] ?? sug.tipoFresco}</span>
            )}
            {item.barcode && (
              <span style={{ fontFamily: 'monospace', opacity: 0.5 }}>{item.barcode}</span>
            )}
          </div>
        </div>

        {/* Controles */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {/* Guardar individualmente */}
          {!item.saving && !item.removing && item.action !== 'skip' && (
            <button
              onClick={onSave}
              title="Guardar en despensa"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, border: 'none',
                background: '#1D9E75', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <CheckCircle size={12} /> Guardar
            </button>
          )}
          {/* Skip / unskip */}
          <button
            onClick={() => onUpdate({ action: item.action === 'skip' ? 'new' : 'skip' })}
            title={item.action === 'skip' ? 'Incluir' : 'Omitir'}
            aria-label={item.action === 'skip' ? 'Incluir' : 'Omitir'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: item.action === 'skip' ? 'var(--teal)' : 'var(--muted)',
            }}
          >
            {item.action === 'skip' ? <CheckCircle size={16} /> : <span style={{ fontSize: 14 }}>✕</span>}
          </button>
          {/* Editar / expandir */}
          <button onClick={onToggle} aria-label={expanded ? 'Contraer detalles' : 'Editar detalles'} aria-expanded={expanded} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {/* Eliminar */}
          <button onClick={onRemove} aria-label="Eliminar producto" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stoqly tip */}
      {sug?.stoqlyTip && !expanded && (
        <div style={{ padding: '0 14px 10px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          💬 {sug.stoqlyTip}
        </div>
      )}

      {/* Panel expandido */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Conservación fresco */}
          {isFresco && sug?.conservacion && (
            <div style={{
              padding: '10px 12px', background: 'rgba(59,109,17,0.08)',
              border: '1px solid rgba(59,109,17,0.2)', borderRadius: 8, marginBottom: 12, marginTop: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3B6D11', marginBottom: 3 }}>
                <Leaf size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Conservación — {sug.vidaUtilDias ? `~${sug.vidaUtilDias} días` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sug.conservacion}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {/* Zona */}
            <div>
              <label style={lbl}>Zona</label>
              <select
                value={item.zoneId ?? ''}
                onChange={e => onUpdate({ zoneId: e.target.value || undefined })}
                style={{ ...inp, marginBottom: 0 }}
              >
                <option value="">Sin zona</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.icon} {z.name}</option>)}
              </select>
            </div>

            {/* Cantidad */}
            <div>
              <label style={lbl}>Cantidad</label>
              <input
                type="number" min="0.1" step="0.1"
                value={item.quantity}
                onChange={e => onUpdate({ quantity: parseFloat(e.target.value) || 1 })}
                style={{ ...inp, marginBottom: 0 }}
              />
            </div>
          </div>

          {/* Fecha de caducidad (solo si no es fresco) */}
          {!isFresco && (
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>Fecha de caducidad (opcional)</label>
              <input
                type="date"
                value={item.expiryDate ?? ''}
                onChange={e => onUpdate({ expiryDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                style={{ ...inp, marginBottom: 0, colorScheme: 'dark' }}
              />
            </div>
          )}

          {/* Escaneo de etiqueta: fecha de caducidad + lote por foto (Stoqly Vision) */}
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Foto de etiqueta (fecha + lote)</label>
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => handleLabelPhoto(e.target.files?.[0])}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => ocrInputRef.current?.click()}
                disabled={ocrStatus === 'loading'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                  borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--muted)', fontSize: 12, fontWeight: 600,
                  cursor: ocrStatus === 'loading' ? 'default' : 'pointer',
                }}
              >
                {ocrStatus === 'loading'
                  ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analizando...</>
                  : <><Camera size={13} /> Escanear etiqueta</>}
              </button>
              {ocrStatus === 'done' && ocrResult && (
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {ocrResult.expiryDate || ocrResult.lotNumber
                    ? `✅ Detectado${ocrResult.confidence === 'baja' ? ' (revisa los datos)' : ''}`
                    : 'Sin datos legibles en la foto'}
                </span>
              )}
              {ocrStatus === 'error' && (
                <span style={{ fontSize: 11, color: '#E0735C' }}>No se pudo analizar la foto</span>
              )}
            </div>
            {ocrResult?.notes && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                💬 {ocrResult.notes}
              </div>
            )}
          </div>

          {/* Lote (opcional, editable) */}
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Lote (opcional)</label>
            <input
              type="text"
              value={item.lotNumber ?? ''}
              onChange={e => onUpdate({ lotNumber: e.target.value })}
              placeholder="Ej: L240612A"
              style={{ ...inp, marginBottom: 0 }}
            />
          </div>

          {/* Acción si hay consolidación */}
          {sug?.consolidarCon && (
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>¿Qué hacer? Ya tienes <strong>{sug.consolidarCon}</strong></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onUpdate({ action: 'consolidate' })}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    border: item.action === 'consolidate' ? '1px solid #EF9F27' : '1px solid var(--border)',
                    background: item.action === 'consolidate' ? 'rgba(239,159,39,0.1)' : 'transparent',
                    color: item.action === 'consolidate' ? '#EF9F27' : 'var(--muted)',
                    fontWeight: 600,
                  }}
                >
                  📦 Añadir al existente
                </button>
                <button
                  onClick={() => onUpdate({ action: 'new' })}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    border: item.action === 'new' ? '1px solid var(--teal)' : '1px solid var(--border)',
                    background: item.action === 'new' ? 'rgba(78,205,196,0.1)' : 'transparent',
                    color: item.action === 'new' ? 'var(--teal)' : 'var(--muted)',
                    fontWeight: 600,
                  }}
                >
                  ➕ Entrada nueva
                </button>
              </div>
            </div>
          )}

          {/* Tip de Stoqly */}
          {sug?.stoqlyTip && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              💬 {sug.stoqlyTip}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
  fontSize: 13, boxSizing: 'border-box', outline: 'none',
}
const btnSmall: React.CSSProperties = {
  padding: '0 14px', background: 'var(--teal)', color: '#0F0F1A',
  border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
}
