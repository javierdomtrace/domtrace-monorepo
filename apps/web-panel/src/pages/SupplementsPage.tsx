import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, Minus, ChevronDown, ChevronUp, AlertTriangle, ScanLine, X, Edit2 } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────

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

// ── Constantes ────────────────────────────────────────────────────────

const FRECUENCIA_LABELS: Record<string, string> = {
  DIARIO:          '📅 Diario',
  CADA_8H:         '⏱ Cada 8h',
  CADA_12H:        '⏱ Cada 12h',
  SEMANAL:         '📆 Semanal',
  SEGUN_NECESIDAD: '💡 Según necesidad',
}

const UNIT_OPTS = ['cáps.', 'comp.', 'ml', 'g', 'sobres', 'u']

const FRECUENCIA_OPTS = Object.entries(FRECUENCIA_LABELS)

// ── Componente principal ──────────────────────────────────────────────

export function SupplementsPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<Supplement | null>(null)

  // Form nuevo suplemento
  const [form, setForm] = useState({
    name: '', quantity: '30', unit: 'cáps.', dosisDesc: '', frecuenciaToma: '', notes: '',
    barcode: '', barcodeIsNew: false,
  })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['supplements'],
    queryFn: () => api.get('/supplements'),
    refetchInterval: 60_000,
  })

  const items: Supplement[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const lowStockCount: number = data?.lowStockCount ?? 0

  const add = useMutation({
    mutationFn: async () => {
      const result = await api.post('/supplements', {
        name: form.name.trim(),
        quantity: parseFloat(form.quantity) || 30,
        unit: form.unit,
        ...(form.dosisDesc     && { dosisDesc: form.dosisDesc }),
        ...(form.frecuenciaToma && { frecuenciaToma: form.frecuenciaToma }),
        ...(form.notes         && { notes: form.notes }),
        ...(form.barcode       && { barcode: form.barcode }),
      })
      // Si el código de barras era nuevo (no estaba en ninguna BD externa), contribuir a la comunidad
      if (form.barcodeIsNew && form.barcode && form.name.trim()) {
        api.post('/product/contribute', {
          barcode: form.barcode,
          name: form.name.trim(),
          categoryId: 'SUPLEMENTOS',
        }).catch(() => {})
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplements'] })
      setForm({ name: '', quantity: '30', unit: 'cáps.', dosisDesc: '', frecuenciaToma: '', notes: '', barcode: '', barcodeIsNew: false })
      setAdding(false)
    },
  })

  const consume = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      api.patch(`/supplements/${id}`, { quantity: Math.max(0, qty - 1) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })

  const restock = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      api.patch(`/supplements/${id}`, { quantity: qty + 30 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.delete(`/supplements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/supplements/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplements'] }); setEditingItem(null) },
  })

  // Cuando el escáner encuentra o no un producto: pre-rellenar formulario
  function handleScannedProduct(data: { name?: string; brand?: string; imageUrl?: string; barcode?: string; fromCommunity?: boolean }) {
    setShowScanner(false)
    setAdding(true)
    const nombreCompleto = data.name
      ? (data.brand ? `${data.name} ${data.brand}`.trim() : data.name)
      : ''
    setForm(f => ({
      ...f,
      name: nombreCompleto,
      barcode: data.barcode ?? '',
      barcodeIsNew: !data.name && !!data.barcode, // no estaba en ninguna BD externa
    }))
  }

  return (
    <div>
      {/* Escáner de código de barras */}
      {showScanner && (
        <SupplementBarcodeScanner
          onFound={handleScannedProduct}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Suplementos</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {items.length} suplemento{items.length !== 1 ? 's' : ''}
            {lowStockCount > 0 && (
              <span style={{ marginLeft: 10, color: '#EF9F27', fontWeight: 700 }}>
                · {lowStockCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowScanner(true)} style={btnSec} title="Escanear código de barras">
            <ScanLine size={16} /> Escanear
          </button>
          <button onClick={() => setAdding(v => !v)} style={btnPrimary}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>

      {/* Formulario añadir */}
      {adding && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--teal)',
          borderRadius: 14, padding: '20px 24px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Nuevo suplemento
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input
                autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Vitamina D3, Magnesio, Omega-3..."
                style={inp}
              />
            </div>
            <div>
              <label style={labelStyle}>Stock actual</label>
              <input
                type="number" min="1" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                style={inp}
              />
            </div>
            <div>
              <label style={labelStyle}>Unidad</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                {UNIT_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Dosis (opcional)</label>
              <input
                value={form.dosisDesc} onChange={e => setForm(f => ({ ...f, dosisDesc: e.target.value }))}
                placeholder="Ej: 1 cápsula en ayunas"
                style={inp}
              />
            </div>
            <div>
              <label style={labelStyle}>Frecuencia</label>
              <select value={form.frecuenciaToma} onChange={e => setForm(f => ({ ...f, frecuenciaToma: e.target.value }))} style={inp}>
                <option value="">Sin especificar</option>
                {FRECUENCIA_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Notas (opcional)</label>
              <input
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ej: Con vitamina K2, tomar con comida grasa..."
                style={inp}
              />
            </div>
            <div>
              <label style={labelStyle}>Código de barras (opcional)</label>
              <input
                value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value.trim(), barcodeIsNew: true }))}
                placeholder="Ej: 8410091012345"
                inputMode="numeric"
                style={inp}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnSec}>Cancelar</button>
            <button
              onClick={() => form.name.trim() && add.mutate()}
              disabled={!form.name.trim() || add.isPending}
              style={{ ...btnPrimary, opacity: (!form.name.trim() || add.isPending) ? 0.6 : 1 }}
            >
              {add.isPending ? 'Guardando...' : 'Añadir suplemento'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Cargando...</div>
      ) : items.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div key={item.id}>
              <SupplementCard
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(v => v === item.id ? null : item.id)}
                onConsume={() => consume.mutate({ id: item.id, qty: item.quantity })}
                onRestock={() => restock.mutate({ id: item.id, qty: item.quantity })}
                onEdit={() => setEditingItem(item)}
                onDiscard={() => {
                  if (confirm(`¿Eliminar "${item.name}"?`)) discard.mutate(item.id)
                }}
              />
              {editingItem?.id === item.id && (
                <SupplementEditForm
                  item={editingItem}
                  onSave={(data) => update.mutate({ id: item.id, data })}
                  onCancel={() => setEditingItem(null)}
                  loading={update.isPending}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de suplemento ─────────────────────────────────────────────

function SupplementCard({ item, expanded, onToggle, onConsume, onRestock, onDiscard, onEdit }: {
  item: Supplement
  expanded: boolean
  onToggle: () => void
  onConsume: () => void
  onRestock: () => void
  onDiscard: () => void
  onEdit: () => void
}) {
  const stockPct = Math.min(100, (item.quantity / 30) * 100)
  const stockColor = item.quantity <= 5 ? '#E24B4A' : item.quantity <= 10 ? '#EF9F27' : '#1D9E75'

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${item.lowStock ? 'rgba(239,159,39,0.4)' : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Fila principal */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 14 }}>
        {/* Icono */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'rgba(29,158,117,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          💊
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
            {item.lowStock && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#EF9F27', background: 'rgba(239,159,39,0.1)', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>
                <AlertTriangle size={11} /> Stock bajo
              </span>
            )}
            {item.frecuenciaToma && (
              <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 8, padding: '2px 8px' }}>
                {FRECUENCIA_LABELS[item.frecuenciaToma] ?? item.frecuenciaToma}
              </span>
            )}
          </div>
          {item.dosisDesc && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.dosisDesc}</div>
          )}
          {/* Barra de stock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${stockPct}%`, height: '100%', background: stockColor, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: stockColor, fontWeight: 600, flexShrink: 0 }}>
              {item.quantity} {item.unit}
            </span>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onConsume} title="Consumir 1 unidad" aria-label="Consumir 1 unidad"
            style={{ ...iconBtn, background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={onRestock} title="Reponer +30" aria-label="Reponer +30"
            style={{ ...iconBtn, background: 'rgba(127,119,221,0.1)', color: '#7F77DD' }}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onToggle}
            aria-label={expanded ? 'Ocultar detalles' : 'Ver detalles'} aria-expanded={expanded}
            style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--muted)' }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{
          padding: '0 18px 16px', borderTop: '1px solid var(--border)',
          paddingTop: 14,
        }}>
          {item.notes && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>
              📝 {item.notes}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={onEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#1D9E75', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
            >
              <Edit2 size={13} /> Editar
            </button>
            <button
              onClick={onDiscard}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
            >
              <Trash2 size={13} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulario de edición ─────────────────────────────────────────────

function SupplementEditForm({ item, onSave, onCancel, loading }: {
  item: Supplement; onSave: (data: any) => void; onCancel: () => void; loading: boolean
}) {
  const [name, setName]                 = useState(item.name)
  const [quantity, setQuantity]         = useState(String(item.quantity))
  const [unit, setUnit]                 = useState(item.unit)
  const [dosisDesc, setDosisDesc]       = useState(item.dosisDesc ?? '')
  const [frecuenciaToma, setFrecuencia] = useState(item.frecuenciaToma ?? '')
  const [notes, setNotes]               = useState(item.notes ?? '')

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid #1D9E75', borderRadius: 12, padding: '16px 18px', marginTop: 4, marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1D9E75', marginBottom: 12 }}>Editar suplemento</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Nombre</label><input style={inp} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label style={labelStyle}>Stock</label><input type="number" style={inp} value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
        <div><label style={labelStyle}>Unidad</label>
          <select style={inp} value={unit} onChange={e => setUnit(e.target.value)}>
            {UNIT_OPTS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Dosis</label><input style={inp} value={dosisDesc} onChange={e => setDosisDesc(e.target.value)} placeholder="Ej: 1 cápsula en ayunas" /></div>
        <div><label style={labelStyle}>Frecuencia</label>
          <select style={inp} value={frecuenciaToma} onChange={e => setFrecuencia(e.target.value)}>
            <option value="">—</option>
            {FRECUENCIA_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={labelStyle}>Notas</label><input style={inp} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSave({ name, quantity: parseFloat(quantity) || item.quantity, unit, dosisDesc: dosisDesc || null, frecuenciaToma: frecuenciaToma || null, notes: notes || null })}
          disabled={!name.trim() || loading}
          style={{ ...btnPrimary, opacity: (!name.trim() || loading) ? 0.6 : 1 }}
        >{loading ? 'Guardando…' : 'Guardar cambios'}</button>
        <button onClick={onCancel} style={btnSec}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Estado vacío ──────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 20px',
      background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💊</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
        Sin suplementos registrados
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 14, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        Añade tus vitaminas, minerales u otros suplementos y Stoqly te avisará cuando te queden pocos.
      </p>
      <button onClick={onAdd} style={btnPrimary}>
        <Plus size={16} /> Añadir primer suplemento
      </button>
    </div>
  )
}

// ── Escáner de suplementos ────────────────────────────────────────────

const SCANNER_ID = 'supplement-barcode-scanner'

function SupplementBarcodeScanner({
  onFound,
  onClose,
}: {
  onFound: (data: { name?: string; brand?: string; imageUrl?: string; barcode?: string; barcodeIsNew?: boolean }) => void
  onClose: () => void
}) {
  const scannerRef = useRef<any>(null)
  const [status, setStatus] = useState<'scanning' | 'found' | 'notfound' | 'error'>('scanning')
  const [product, setProduct] = useState<{ name?: string; brand?: string; imageUrl?: string } | null>(null)
  const [barcode, setBarcode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualName, setManualName] = useState('')

  useEffect(() => {
    let stopped = false

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 100 } },
          async (code: string) => {
            if (stopped) return
            stopped = true
            setBarcode(code)
            await scanner.stop().catch(() => {})
            try {
              const data = await api.get<any>(`/product/${code}`)
              if (data?.name) {
                setProduct(data)
                setStatus('found')
              } else {
                setStatus('notfound')
              }
            } catch {
              setStatus('notfound')
            }
          },
          () => {}
        )
      } catch (e: any) {
        if (!stopped) {
          setErrorMsg(e.message ?? 'No se pudo acceder a la cámara')
          setStatus('error')
        }
      }
    }

    start()
    return () => { stopped = true; scannerRef.current?.stop().catch(() => {}) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, width: 460, maxWidth: '95vw', overflow: 'hidden',
      }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScanLine size={18} style={{ color: '#1D9E75' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Escanear suplemento</span>
          </div>
          <button onClick={() => { scannerRef.current?.stop().catch(() => {}); onClose() }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
            aria-label="Cerrar escáner">
            <X size={18} />
          </button>
        </div>

        {/* Cámara activa */}
        {status === 'scanning' && (
          <div>
            <div id={SCANNER_ID} style={{ width: '100%', background: '#000' }} />
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0', margin: 0 }}>
              Centra el código de barras en el recuadro
            </p>
          </div>
        )}

        {/* Producto reconocido */}
        {status === 'found' && product && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
              {product.imageUrl && (
                <img src={product.imageUrl} alt={`Foto del producto ${product.name}`} style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4, flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>✅ {product.name}</div>
                {product.brand && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{product.brand}</div>}
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginTop: 4 }}>{barcode}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
              Se usará este nombre. Podrás ajustar dosis y frecuencia en el paso siguiente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ ...scBtnSec, flex: 1 }}>Cancelar</button>
              <button onClick={() => onFound({ ...product, barcode, barcodeIsNew: false })} style={{ ...scBtnPri, flex: 2 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* No encontrado — relleno manual */}
        {status === 'notfound' && (
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
              💊 Producto no reconocido
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', marginBottom: 12 }}>
              Código: {barcode}
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
              No está en nuestra base de datos aún. Escribe el nombre y lo guardamos — la próxima vez se reconocerá solo.
            </p>
            <label style={scLbl}>Nombre del suplemento</label>
            <input
              autoFocus
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Ej: Vitamina D3 4000 UI, Magnesio 400mg..."
              style={scInp}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={onClose} style={{ ...scBtnSec, flex: 1 }}>Cancelar</button>
              <button
                onClick={() => manualName.trim() && onFound({ name: manualName.trim(), barcode, barcodeIsNew: true })}
                disabled={!manualName.trim()}
                style={{ ...scBtnPri, flex: 2, opacity: manualName.trim() ? 1 : 0.5 }}
              >
                Añadir con este nombre →
              </button>
            </div>
          </div>
        )}

        {/* Error de cámara */}
        {status === 'error' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 8 }}>No se pudo acceder a la cámara</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={onClose} style={{ ...scBtnSec, width: '100%' }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

const scLbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }
const scInp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
  fontSize: 14, marginBottom: 4, boxSizing: 'border-box', outline: 'none',
}
const scBtnPri: React.CSSProperties = { padding: '11px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#0F0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const scBtnSec: React.CSSProperties = { padding: '11px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }

// ── Estilos ───────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', background: 'var(--teal)', color: '#0F0F1A',
  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
}

const btnSec: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 500,
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
