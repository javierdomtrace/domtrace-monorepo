import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus, X, Droplets, Flower2, Wind, Palette, Package, Sun, Moon, Clock, Camera, ScanLine } from 'lucide-react'
import { api } from '../lib/api'

interface CosmeticTip {
  momento: string
  frecuencia: string
  consejo: string
  evitar: string | null
}

// ─── Escáner de código de barras para cosméticos ─────────────────────────────
const SCANNER_ID = 'cosmetic-barcode-scanner'

function CosmeticBarcodeScanner({ onFound, onClose }: {
  onFound: (data: { name: string; brand?: string; imageUrl?: string; categoryId?: string | null; paoMonths?: number | null; ingredients?: string | null }) => void
  onClose: () => void
}) {
  const scannerRef = useRef<any>(null)
  const [status, setStatus] = useState<'scanning' | 'found' | 'notfound' | 'error'>('scanning')
  const [product, setProduct] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

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
            await scanner.stop().catch(() => {})
            try {
              const data = await api.get<any>(`/product/${code}`)
              setProduct(data)
              setStatus('found')
            } catch {
              setStatus('notfound')
            }
          },
          () => {}
        )
      } catch (e: any) {
        if (!stopped) { setErrorMsg(e.message ?? 'Sin acceso a cámara'); setStatus('error') }
      }
    }
    start()
    return () => { stopped = true; scannerRef.current?.stop().catch(() => {}) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, width: 460, maxWidth: '95vw', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScanLine size={18} style={{ color: '#C084FC' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Escanear cosmético</span>
          </div>
          <button onClick={() => { scannerRef.current?.stop().catch(() => {}); onClose() }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
            aria-label="Cerrar escáner">
            <X size={18} />
          </button>
        </div>

        {status === 'scanning' && (
          <div>
            <div id={SCANNER_ID} style={{ width: '100%', background: '#000' }} />
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '10px 0', margin: 0 }}>
              Centra el código de barras en el recuadro
            </p>
          </div>
        )}

        {status === 'found' && product && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
              {product.imageUrl && (
                <img src={product.imageUrl} alt={`Foto del producto ${product.name ?? 'encontrado'}`} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4, flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                  {product.name ?? 'Producto encontrado'}
                </div>
                {product.brand && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{product.brand}</div>}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  {product.source === 'beauty' ? '✨ Open Beauty Facts' : '🥦 Open Food Facts'}
                  {product.paoMonths && ` · PAO ${product.paoMonths}M`}
                  {product.categoryId && ` · ${product.categoryId}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { onFound(product); onClose() }}
                style={{
                  flex: 1, background: '#C084FC', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '11px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                Usar este producto
              </button>
              <button onClick={onClose} style={{
                padding: '11px 16px', background: 'none', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--muted)', fontSize: 13,
              }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {status === 'notfound' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>Producto no encontrado</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>No está en Open Food Facts ni en Open Beauty Facts. Añádelo manualmente.</div>
            <button onClick={onClose} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 24px', cursor: 'pointer', color: 'var(--muted)', fontSize: 13,
            }}>Cerrar</button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{errorMsg || 'No se pudo acceder a la cámara'}</div>
            <button onClick={onClose} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 24px', cursor: 'pointer', color: 'var(--muted)', fontSize: 13,
            }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── tipos ─────────────────────────────────────────────────────────────────

interface CosmeticItem {
  id: string
  name: string
  categoryId: string | null
  openedAt: string | null
  paoMonths: number | null
  quantity: number
  unit: string
  notes: string | null
  status: string
}

// ─── constantes ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',    label: 'Todos',    icon: Sparkles },
  { id: 'face',   label: 'Rostro',   icon: Flower2 },
  { id: 'body',   label: 'Cuerpo',   icon: Droplets },
  { id: 'hair',   label: 'Cabello',  icon: Wind },
  { id: 'makeup', label: 'Maquillaje', icon: Palette },
  { id: 'other',  label: 'Otros',    icon: Package },
]

const PAO_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24, 36]

// ─── helpers ─────────────────────────────────────────────────────────────────

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
  if (status === 'expired') return '#EF4444'
  if (status === 'warning') return '#F59E0B'
  if (status === 'ok') return '#4ECDC4'
  return 'var(--border)'
}

function categoryLabel(id: string | null) {
  return CATEGORIES.find(c => c.id === id)?.label ?? 'Otros'
}

// ─── componente principal ────────────────────────────────────────────────────

export function CosmeticsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  // tips de Vicky: itemId → { tip, loading }
  const [tips, setTips] = useState<Record<string, { tip?: CosmeticTip; loading: boolean }>>({})

  const fetchTip = useCallback(async (item: CosmeticItem) => {
    if (tips[item.id]?.tip || tips[item.id]?.loading) return
    setTips(prev => ({ ...prev, [item.id]: { loading: true } }))
    try {
      const params = new URLSearchParams({ name: item.name })
      if (item.categoryId) params.set('category', item.categoryId)
      const res = await api.get<{ data: CosmeticTip }>(`/stoqly/cosmetic-tip?${params}`)
      setTips(prev => ({ ...prev, [item.id]: { loading: false, tip: (res as any).data } }))
    } catch {
      setTips(prev => ({ ...prev, [item.id]: { loading: false } }))
    }
  }, [tips])

  // formulario
  const [fName, setFName] = useState('')
  const [fBarcode, setFBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeMsg, setBarcodeMsg] = useState('')
  const [fCategory, setFCategory] = useState('face')
  const [fPao, setFPao] = useState<number>(12)
  const [fQty, setFQty] = useState('1')
  const [fUnit, setFUnit] = useState('u')
  const [fNotes, setFNotes] = useState('')

  // ─── datos ─────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['cosmetics', activeTab],
    queryFn: () => {
      const params: Record<string, string> = {
        sort: 'openedAt',
        order: 'asc',
        limit: '100',
      }
      if (activeTab === 'all') {
        params.categoryIds = 'face,body,hair,makeup,other'
      } else {
        params.categoryId = activeTab
      }
      const qs = new URLSearchParams(params).toString()
      return api.get<CosmeticItem[]>(`/items?${qs}`)
    },
  })

  const items: CosmeticItem[] = data ?? []

  const summary = {
    total:   items.length,
    opened:  items.filter(i => i.openedAt).length,
    warning: items.filter(i => { const p = calcPAO(i); return p.status === 'warning' }).length,
    expired: items.filter(i => { const p = calcPAO(i); return p.status === 'expired' }).length,
  }

  // ─── mutaciones ─────────────────────────────────────────────────────────

  const openItem = useMutation({
    mutationFn: (item: CosmeticItem) => api.patch(`/items/${item.id}/open`, {}),
    onSuccess: (_data, item) => {
      qc.invalidateQueries({ queryKey: ['cosmetics'] })
      fetchTip(item)
    },
  })

  const discardItem = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cosmetics'] }),
  })

  const addItem = useMutation({
    mutationFn: () => api.post('/items', {
      name: fName,
      barcode: fBarcode.trim() || undefined,   // guardado para la BD comunitaria de Stoqly
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

  // ─── render ─────────────────────────────────────────────────────────────

  async function lookupManualBarcode(barcode: string) {
    if (!/^\d{8,14}$/.test(barcode)) return
    setBarcodeLoading(true)
    setBarcodeMsg('')
    try {
      const data = await api.get<any>(`/product/${barcode}`)
      if (data?.name) {
        handleScannedProduct(data)
        setBarcodeMsg('')
      } else {
        setBarcodeMsg('⚠️ Producto no reconocido aún — rellena el nombre y al guardar quedará en la base de datos de Stoqly para otros usuarios.')
      }
    } catch {
      setBarcodeMsg('⚠️ No encontrado todavía. Rellénalo manualmente — al guardar lo añadimos a nuestra base de datos para que otros lo encuentren.')
    }
    finally { setBarcodeLoading(false) }
  }

  function handleScannedProduct(data: { name: string; brand?: string; imageUrl?: string; categoryId?: string | null; paoMonths?: number | null; ingredients?: string | null }) {
    setFName(data.brand ? `${data.name} (${data.brand})` : (data.name ?? ''))
    if (data.categoryId) setFCategory(data.categoryId)
    if (data.paoMonths) setFPao(data.paoMonths)
    if (data.ingredients) setFNotes(data.ingredients.slice(0, 200))
    setShowForm(true)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {showScanner && (
        <CosmeticBarcodeScanner
          onFound={handleScannedProduct}
          onClose={() => setShowScanner(false)}
        />
      )}
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={28} style={{ color: '#C084FC' }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Belleza e Higiene</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Controla la vida útil de tus cosméticos</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowScanner(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', color: '#C084FC',
              border: '1px solid rgba(192,132,252,0.4)',
              borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            <Camera size={16} />
            Escanear
          </button>
          <button
            onClick={() => setShowForm(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#C084FC', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 18px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            <Plus size={16} />
            Añadir
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total', value: summary.total,   color: '#C084FC', bg: 'rgba(192,132,252,0.08)' },
          { label: 'Abiertos', value: summary.opened, color: '#4ECDC4', bg: 'rgba(78,205,196,0.08)' },
          { label: 'Advertencia', value: summary.warning, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Caducados', value: summary.expired, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
        ].map(c => (
          <div key={c.label} style={{
            background: c.bg, border: `1px solid ${c.color}22`,
            borderRadius: 14, padding: '18px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Formulario nuevo producto */}
      {showForm && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 24, marginBottom: 28,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Nuevo cosmético</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} aria-label="Cerrar formulario">
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Código de barras manual */}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Código de barras (opcional)</label>
                <input
                  value={fBarcode}
                  onChange={e => setFBarcode(e.target.value)}
                  onBlur={e => lookupManualBarcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupManualBarcode(fBarcode)}
                  placeholder="ej. 3600523688463"
                  maxLength={14}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
                    fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace',
                  }}
                />
              </div>
              <button
                onClick={() => lookupManualBarcode(fBarcode)}
                disabled={barcodeLoading || !/^\d{8,14}$/.test(fBarcode)}
                style={{
                  padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  cursor: 'pointer', color: '#C084FC', fontSize: 13,
                  opacity: !/^\d{8,14}$/.test(fBarcode) ? 0.4 : 1,
                  whiteSpace: 'nowrap', marginBottom: 0,
                }}
              >
                {barcodeLoading ? '…' : '🔍 Buscar'}
              </button>
            </div>
            {barcodeMsg && (
              <p style={{ fontSize: 12, color: '#F59E0B', margin: '6px 0 0', gridColumn: '1/-1' }}>{barcodeMsg}</p>
            )}

            {/* Nombre */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Nombre del producto *</label>
              <input
                value={fName} onChange={e => setFName(e.target.value)}
                placeholder="ej. Crema hidratante Neutrogena"
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Categoría */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Categoría</label>
              <select
                value={fCategory} onChange={e => setFCategory(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14,
                }}
              >
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* PAO */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>PAO — vida útil tras apertura</label>
              <select
                value={fPao} onChange={e => setFPao(Number(e.target.value))}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14,
                }}
              >
                {PAO_OPTIONS.map(m => (
                  <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>
                ))}
              </select>
            </div>

            {/* Cantidad y unidad */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Cantidad</label>
                <input
                  type="number" min="1" value={fQty} onChange={e => setFQty(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Unidad</label>
                <input
                  value={fUnit} onChange={e => setFUnit(e.target.value)}
                  placeholder="u"
                  style={{
                    width: '100%', padding: '10px 14px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Notas */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Notas (opcional)</label>
              <input
                value={fNotes} onChange={e => setFNotes(e.target.value)}
                placeholder="ej. Para uso nocturno, piel seca"
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => addItem.mutate()}
              disabled={!fName.trim() || addItem.isPending}
              style={{
                flex: 1, background: '#C084FC', color: '#fff', border: 'none',
                borderRadius: 8, padding: '11px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                opacity: !fName.trim() ? 0.5 : 1,
              }}
            >
              {addItem.isPending ? 'Guardando…' : 'Guardar producto'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: '11px 20px', background: 'none', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--muted)', fontSize: 14,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabs de categoría */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 20,
              border: activeTab === id ? '2px solid #C084FC' : '1px solid var(--border)',
              background: activeTab === id ? 'rgba(192,132,252,0.12)' : 'var(--surface)',
              color: activeTab === id ? '#C084FC' : 'var(--muted)',
              cursor: 'pointer', fontSize: 13, fontWeight: activeTab === id ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Lista de productos */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Cargando…</div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--muted)',
          background: 'var(--surface)', borderRadius: 16, border: '1px dashed var(--border)',
        }}>
          <Sparkles size={36} style={{ color: '#C084FC', marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Sin productos en esta categoría</div>
          <div style={{ fontSize: 13 }}>Añade un cosmético para empezar a controlar su vida útil</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const pao = calcPAO(item)
            const color = paoColor(pao.status)

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)', border: `1px solid ${pao.status === 'expired' ? '#EF444433' : pao.status === 'warning' ? '#F59E0B33' : 'var(--border)'}`,
                  borderRadius: 14, padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{item.name}</span>
                      {pao.status === 'expired' && (
                        <span style={{ fontSize: 11, background: '#EF4444', color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>CADUCADO</span>
                      )}
                      {pao.status === 'warning' && (
                        <span style={{ fontSize: 11, background: '#F59E0B', color: '#fff', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>AVISAR</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)', marginBottom: 10, flexWrap: 'wrap' }}>
                      <span>{categoryLabel(item.categoryId)}</span>
                      <span>·</span>
                      <span>{item.quantity} {item.unit}</span>
                      {item.paoMonths && <><span>·</span><span>PAO {item.paoMonths}M</span></>}
                      {item.openedAt && (
                        <>
                          <span>·</span>
                          <span>Abierto {new Date(item.openedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </>
                      )}
                    </div>

                    {/* Barra PAO */}
                    {item.paoMonths ? (
                      pao.status === 'unopened' ? (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 12, color: '#4ECDC4', background: 'rgba(78,205,196,0.08)',
                          borderRadius: 6, padding: '4px 10px',
                        }}>
                          Sin abrir — {item.paoMonths} {item.paoMonths === 1 ? 'mes' : 'meses'} de vida tras apertura
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                            <span style={{ color }}>{pao.pct}% consumido</span>
                            <span>
                              {pao.status === 'expired'
                                ? `Caducado hace ${Math.abs(pao.daysLeft)} días`
                                : `${pao.daysLeft} días restantes`}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pao.pct}%`,
                              background: color, borderRadius: 3,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      )
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sin fecha PAO configurada</div>
                    )}

                    {item.notes && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{item.notes}</div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {!item.openedAt && (
                      <button
                        onClick={() => openItem.mutate(item)}
                        disabled={openItem.isPending}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'rgba(78,205,196,0.12)', color: '#4ECDC4',
                          border: '1px solid rgba(78,205,196,0.3)', borderRadius: 8,
                          padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Abrir hoy
                      </button>
                    )}
                    <button
                      onClick={() => fetchTip(item)}
                      disabled={tips[item.id]?.loading}
                      title="Consejo de Vicky"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: tips[item.id]?.tip ? 'rgba(192,132,252,0.12)' : 'none',
                        color: '#C084FC',
                        border: '1px solid rgba(192,132,252,0.3)', borderRadius: 8,
                        padding: '7px 14px', cursor: 'pointer', fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tips[item.id]?.loading ? '…' : '✨ Consejo'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Descartar "${item.name}"?`)) discardItem.mutate(item.id)
                      }}
                      disabled={discardItem.isPending}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'none', color: 'var(--muted)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '7px 14px', cursor: 'pointer', fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>

                {/* Tip de Vicky */}
                {tips[item.id]?.tip && (() => {
                  const t = tips[item.id].tip!
                  const momentoIcon = t.momento.includes('mañana') && t.momento.includes('noche')
                    ? <><Sun size={12} /><Moon size={12} /></>
                    : t.momento.includes('mañana') ? <Sun size={12} />
                    : t.momento.includes('noche') ? <Moon size={12} />
                    : <Clock size={12} />
                  return (
                    <div style={{
                      marginTop: 14, padding: '12px 14px',
                      background: 'rgba(192,132,252,0.07)',
                      border: '1px solid rgba(192,132,252,0.2)',
                      borderRadius: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Sparkles size={13} style={{ color: '#C084FC' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#C084FC' }}>Consejo de Vicky</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          marginLeft: 'auto', fontSize: 11, color: '#C084FC',
                          background: 'rgba(192,132,252,0.15)', borderRadius: 6, padding: '2px 8px',
                        }}>
                          {momentoIcon} {t.momento}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{t.consejo}</p>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                        <span>📅 {t.frecuencia}</span>
                        {t.evitar && <span>⚠️ {t.evitar}</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
