import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Plus, Trash2, Minus, ChevronDown, ChevronUp, AlertTriangle, ScanLine, X, CalendarClock, MapPin, Navigation, Phone, ExternalLink, Recycle, Edit2 } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────

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

// ── Constantes ────────────────────────────────────────────────────────

const FRECUENCIA_LABELS: Record<string, string> = {
  DIARIO:          '📅 Diario',
  CADA_8H:         '⏱ Cada 8h',
  CADA_12H:        '⏱ Cada 12h',
  SEMANAL:         '📆 Semanal',
  SEGUN_NECESIDAD: '💡 Según necesidad',
}

const UNIT_OPTS = ['comp.', 'cáps.', 'ml', 'mg', 'sobres', 'ampollas', 'u']
const FRECUENCIA_OPTS = Object.entries(FRECUENCIA_LABELS)

// ── Componente principal ──────────────────────────────────────────────

export function MedicationsPage() {
  const qc = useQueryClient()
  const user = useAuth(s => s.user)
  const [adding, setAdding] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showPharmacies, setShowPharmacies] = useState(false)
  const [pharmacyMode, setPharmacyMode] = useState<'restock' | 'sigre'>('restock')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<Medication | null>(null)

  const [form, setForm] = useState({
    name: '', quantity: '20', unit: 'comp.', dosisDesc: '', frecuenciaToma: '',
    notes: '', expiryDate: '', barcode: '', barcodeIsNew: false,
  })

  const { data, isLoading } = useQuery<any>({
    queryKey: ['medications'],
    queryFn: () => api.get('/medications'),
    refetchInterval: 60_000,
  })

  const items: Medication[] = Array.isArray(data?.items) ? data.items : []
  const lowStockCount: number     = data?.lowStockCount ?? 0
  const expiringSoonCount: number = data?.expiringSoonCount ?? 0
  const expiredCount: number      = data?.expiredCount ?? 0
  const alertCount = lowStockCount + expiringSoonCount + expiredCount

  const add = useMutation({
    mutationFn: async () => {
      const result = await api.post('/medications', {
        name: form.name.trim(),
        quantity: parseFloat(form.quantity) || 20,
        unit: form.unit,
        ...(form.dosisDesc      && { dosisDesc: form.dosisDesc }),
        ...(form.frecuenciaToma && { frecuenciaToma: form.frecuenciaToma }),
        ...(form.notes          && { notes: form.notes }),
        ...(form.expiryDate     && { expiryDate: form.expiryDate }),
        ...(form.barcode        && { barcode: form.barcode }),
      })
      if (form.barcodeIsNew && form.barcode && form.name.trim()) {
        api.post('/product/contribute', {
          barcode: form.barcode, name: form.name.trim(), categoryId: 'MEDICAMENTOS',
        }).catch(() => {})
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] })
      setForm({ name: '', quantity: '20', unit: 'comp.', dosisDesc: '', frecuenciaToma: '', notes: '', expiryDate: '', barcode: '', barcodeIsNew: false })
      setAdding(false)
    },
  })

  const consume = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      api.patch(`/medications/${id}`, { quantity: Math.max(0, qty - 1) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  })

  const restock = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      api.patch(`/medications/${id}`, { quantity: qty + 20 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.delete(`/medications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/medications/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] })
      setEditingItem(null)
    },
  })

  function handleScanned(d: { name?: string; brand?: string; barcode?: string; barcodeIsNew?: boolean }) {
    setShowScanner(false)
    setAdding(true)
    const nombre = d.name ? (d.brand ? `${d.name} ${d.brand}`.trim() : d.name) : ''
    setForm(f => ({ ...f, name: nombre, barcode: d.barcode ?? '', barcodeIsNew: d.barcodeIsNew ?? false }))
  }

  // Ordenar: caducados primero, luego próximos, luego el resto
  const sorted = [...items].sort((a, b) => {
    const urgA = a.expired ? 3 : a.expiringSoon ? 2 : a.lowStock ? 1 : 0
    const urgB = b.expired ? 3 : b.expiringSoon ? 2 : b.lowStock ? 1 : 0
    return urgB - urgA
  })

  return (
    <div>
      {showScanner && (
        <MedicationBarcodeScanner onFound={handleScanned} onClose={() => setShowScanner(false)} />
      )}
      {showPharmacies && (
        <PharmacyPanel
          codigoPostal={user?.codigoPostal ?? ''}
          mode={pharmacyMode}
          expiredMeds={sorted.filter(m => m.expired).map(m => m.name)}
          onClose={() => setShowPharmacies(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Medicamentos</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {items.length} medicamento{items.length !== 1 ? 's' : ''}
            {expiredCount > 0 && (
              <span style={{ marginLeft: 10, color: '#E24B4A', fontWeight: 700 }}>· {expiredCount} caducado{expiredCount !== 1 ? 's' : ''}</span>
            )}
            {expiringSoonCount > 0 && (
              <span style={{ marginLeft: 8, color: '#EF9F27', fontWeight: 700 }}>· {expiringSoonCount} próximo{expiringSoonCount !== 1 ? 's' : ''} a caducar</span>
            )}
            {lowStockCount > 0 && (
              <span style={{ marginLeft: 8, color: '#EF9F27', fontWeight: 700 }}>· {lowStockCount} con stock bajo</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {expiredCount > 0 && (
            <button onClick={() => { setPharmacyMode('sigre'); setShowPharmacies(true) }}
              style={{ ...btnSec, color: '#E24B4A', borderColor: 'rgba(226,75,74,0.4)' }}>
              <Recycle size={16} /> Llevar al SIGRE
            </button>
          )}
          <button onClick={() => { setPharmacyMode('restock'); setShowPharmacies(true) }}
            style={btnSec} title="Farmacias cercanas">
            <MapPin size={16} /> Farmacias
          </button>
          <button onClick={() => setShowScanner(true)} style={btnSec}>
            <ScanLine size={16} /> Escanear
          </button>
          <button onClick={() => setAdding(v => !v)} style={btnPrimary}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>

      {/* Formulario */}
      {adding && (
        <div style={{
          background: 'var(--surface)', border: '1px solid #7F77DD',
          borderRadius: 14, padding: '20px 24px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            Nuevo medicamento
          </div>

          {/* Nombre + stock + unidad */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input
                autoFocus value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Ibuprofeno 400mg, Paracetamol, Amoxicilina..."
                style={inp}
              />
            </div>
            <div>
              <label style={labelStyle}>Cantidad</label>
              <input type="number" min="1" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                style={inp} />
            </div>
            <div>
              <label style={labelStyle}>Unidad</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                {UNIT_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Dosis + frecuencia */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Dosis (opcional)</label>
              <input value={form.dosisDesc}
                onChange={e => setForm(f => ({ ...f, dosisDesc: e.target.value }))}
                placeholder="Ej: 1 comprimido cada 8h con comida"
                style={inp} />
            </div>
            <div>
              <label style={labelStyle}>Frecuencia</label>
              <select value={form.frecuenciaToma} onChange={e => setForm(f => ({ ...f, frecuenciaToma: e.target.value }))} style={inp}>
                <option value="">Sin especificar</option>
                {FRECUENCIA_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Caducidad + código de barras */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Fecha de caducidad (opcional)</label>
              <input type="date" value={form.expiryDate}
                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                style={{ ...inp, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Código de barras (opcional)</label>
              <input value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value.trim(), barcodeIsNew: true }))}
                placeholder="Ej: 8470003122336"
                inputMode="numeric"
                style={inp} />
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Notas (opcional)</label>
            <input value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: Con receta, no dar a menores de 12 años..."
              style={inp} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdding(false)} style={btnSec}>Cancelar</button>
            <button
              onClick={() => form.name.trim() && add.mutate()}
              disabled={!form.name.trim() || add.isPending}
              style={{ ...btnPrimary, opacity: (!form.name.trim() || add.isPending) ? 0.6 : 1 }}
            >
              {add.isPending ? 'Guardando...' : 'Añadir medicamento'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Cargando...</div>
      ) : sorted.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => (
            <div key={item.id}>
              <MedicationCard
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(v => v === item.id ? null : item.id)}
                onConsume={() => consume.mutate({ id: item.id, qty: item.quantity })}
                onRestock={() => restock.mutate({ id: item.id, qty: item.quantity })}
                onDiscard={() => { if (confirm(`¿Eliminar "${item.name}"?`)) discard.mutate(item.id) }}
                onFindPharmacy={(mode) => { setPharmacyMode(mode); setShowPharmacies(true) }}
                onEdit={() => setEditingItem(item)}
              />
              {editingItem?.id === item.id && (
                <MedicationEditForm
                  item={editingItem}
                  loading={update.isPending}
                  onCancel={() => setEditingItem(null)}
                  onSave={(data) => update.mutate({ id: editingItem.id, data })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta ────────────────────────────────────────────────────────────

function MedicationCard({ item, expanded, onToggle, onConsume, onRestock, onDiscard, onFindPharmacy, onEdit }: {
  item: Medication; expanded: boolean
  onToggle: () => void; onConsume: () => void; onRestock: () => void; onDiscard: () => void
  onFindPharmacy: (mode: 'restock' | 'sigre') => void; onEdit: () => void
}) {
  const stockPct   = Math.min(100, (item.quantity / 20) * 100)
  const stockColor = item.quantity <= 3 ? '#E24B4A' : item.quantity <= 7 ? '#EF9F27' : '#7F77DD'

  // Color del borde según urgencia
  const borderColor = item.expired
    ? 'rgba(226,75,74,0.5)'
    : item.expiringSoon
      ? 'rgba(239,159,39,0.4)'
      : 'var(--border)'

  const expiryLabel = item.daysUntilExpiry !== null && item.daysUntilExpiry !== undefined
    ? item.expired
      ? `Caducó hace ${Math.abs(item.daysUntilExpiry)} días`
      : item.daysUntilExpiry === 0
        ? 'Caduca hoy'
        : `Caduca en ${item.daysUntilExpiry} días`
    : null

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${borderColor}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 14 }}>
        {/* Icono */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'rgba(127,119,221,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          🩺
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
            {item.expired && (
              <Badge color="#E24B4A" bg="rgba(226,75,74,0.1)"><AlertTriangle size={10} /> Caducado</Badge>
            )}
            {!item.expired && item.expiringSoon && (
              <Badge color="#EF9F27" bg="rgba(239,159,39,0.1)"><CalendarClock size={10} /> Caduca pronto</Badge>
            )}
            {item.lowStock && !item.expired && (
              <Badge color="#EF9F27" bg="rgba(239,159,39,0.1)"><AlertTriangle size={10} /> Stock bajo</Badge>
            )}
            {item.frecuenciaToma && (
              <Badge color="var(--muted)" bg="var(--bg)">{FRECUENCIA_LABELS[item.frecuenciaToma] ?? item.frecuenciaToma}</Badge>
            )}
          </div>

          {item.dosisDesc && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.dosisDesc}</div>
          )}

          {/* Barra stock + caducidad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${stockPct}%`, height: '100%', background: stockColor, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: stockColor, fontWeight: 600, flexShrink: 0 }}>
              {item.quantity} {item.unit}
            </span>
            {expiryLabel && (
              <span style={{ fontSize: 11, color: item.expired ? '#E24B4A' : item.expiringSoon ? '#EF9F27' : 'var(--muted)', flexShrink: 0 }}>
                · {expiryLabel}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {item.expired ? (
            <button onClick={() => onFindPharmacy('sigre')} title="Llevar al SIGRE"
              style={{ ...iconBtn, background: 'rgba(226,75,74,0.1)', color: '#E24B4A' }}>
              <Recycle size={14} />
            </button>
          ) : (
            <button onClick={onConsume} title="Consumir 1"
              style={{ ...iconBtn, background: 'rgba(127,119,221,0.1)', color: '#7F77DD' }}>
              <Minus size={14} />
            </button>
          )}
          <button onClick={() => item.lowStock ? onFindPharmacy('restock') : onRestock()} title={item.lowStock ? 'Buscar farmacia' : 'Reponer +20'}
            style={{ ...iconBtn, background: item.lowStock ? 'rgba(239,159,39,0.1)' : 'rgba(29,158,117,0.1)', color: item.lowStock ? '#EF9F27' : '#1D9E75' }}>
            {item.lowStock ? <MapPin size={14} /> : <Plus size={14} />}
          </button>
          <button onClick={onToggle}
            style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--muted)' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {item.notes && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>📝 {item.notes}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
              <Edit2 size={13} /> Editar
            </button>
            <button onClick={onDiscard}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
              <Trash2 size={13} /> Eliminar medicamento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, color, background: bg,
      borderRadius: 8, padding: '2px 8px', fontWeight: 600,
    }}>
      {children}
    </span>
  )
}

// ── Estado vacío ───────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 20px',
      background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🩺</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Sin medicamentos registrados</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 14, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        Añade tus medicamentos y Stoqly te avisará cuando estén próximos a caducar o te queden pocos.
      </p>
      <button onClick={onAdd} style={btnPrimary}><Plus size={16} /> Añadir primer medicamento</button>
    </div>
  )
}

// ── Panel de farmacias cercanas ────────────────────────────────────────

function PharmacyPanel({
  codigoPostal,
  mode,
  expiredMeds,
  onClose,
}: {
  codigoPostal: string
  mode: 'restock' | 'sigre'
  expiredMeds: string[]
  onClose: () => void
}) {
  const [cp, setCp] = useState(codigoPostal)
  const [searched, setSearched] = useState(!!codigoPostal)

  const { data, isLoading, isError, refetch } = useQuery<any>({
    queryKey: ['pharmacies', cp],
    queryFn: () => api.get(`/pharmacies?cp=${cp}`),
    enabled: searched && /^\d{5}$/.test(cp),
    staleTime: 60 * 60 * 1000,
  })

  const pharmacies: Pharmacy[] = data?.pharmacies ?? []
  const mapsUrl: string = data?.mapsUrl ?? `https://www.google.com/maps/search/farmacia`

  function distanceLabel(m: number) {
    return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
  }

  function googleMapsRoute(p: Pharmacy) {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, width: 500, maxWidth: '95vw', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Cabecera */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {mode === 'sigre'
                  ? <Recycle size={18} style={{ color: '#E24B4A' }} />
                  : <MapPin size={18} style={{ color: '#7F77DD' }} />
                }
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {mode === 'sigre' ? 'Llevar medicamentos al SIGRE' : 'Farmacias cercanas'}
                </span>
              </div>
              {mode === 'sigre' && (
                <div style={{
                  background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.2)',
                  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text)',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>♻️ Punto SIGRE — todas las farmacias</div>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                    Todas las farmacias de España tienen obligatoriamente un contenedor naranja SIGRE donde puedes dejar medicamentos caducados, sin usar o envases vacíos. Es gratuito y seguro.
                  </div>
                  {expiredMeds.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#E24B4A', fontWeight: 500 }}>
                      Para llevar: {expiredMeds.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}>
              <X size={18} />
            </button>
          </div>

          {/* Buscador de CP */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              value={cp}
              onChange={e => setCp(e.target.value.slice(0, 5))}
              placeholder="Código postal (5 dígitos)"
              inputMode="numeric"
              maxLength={5}
              style={{ ...inp, marginBottom: 0, flex: 1 }}
            />
            <button
              onClick={() => { setSearched(true); refetch() }}
              disabled={!/^\d{5}$/.test(cp) || isLoading}
              style={{ ...btnPrimary, opacity: /^\d{5}$/.test(cp) ? 1 : 0.5, flexShrink: 0 }}
            >
              {isLoading ? '...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              Buscando farmacias cercanas...
            </div>
          )}

          {isError && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ color: 'var(--danger)', marginBottom: 12 }}>No se pudo conectar con el servicio de mapas.</div>
              <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#7F77DD', fontSize: 14 }}>
                Ver en Google Maps →
              </a>
            </div>
          )}

          {!isLoading && !isError && searched && pharmacies.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
              <div style={{ color: 'var(--muted)', marginBottom: 16 }}>No encontramos farmacias en un radio de 2 km.<br />Prueba con otro código postal.</div>
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#7F77DD', fontSize: 14, textDecoration: 'none' }}>
                <ExternalLink size={14} /> Buscar en Google Maps
              </a>
            </div>
          )}

          {pharmacies.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 20px',
              borderBottom: i < pharmacies.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Posición */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: i === 0 ? 'rgba(127,119,221,0.15)' : 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: i === 0 ? '#7F77DD' : 'var(--muted)',
              }}>
                {i + 1}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {p.name}
                  {i === 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#7F77DD', background: 'rgba(127,119,221,0.1)', borderRadius: 6, padding: '1px 7px' }}>
                      Más cercana
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{p.address}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600 }}>
                    📍 {distanceLabel(p.distance)}
                  </span>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                      <Phone size={11} /> {p.phone}
                    </a>
                  )}
                  {p.openingHours && (
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>🕐 {p.openingHours}</span>
                  )}
                </div>
              </div>

              {/* Botón ruta */}
              <a
                href={googleMapsRoute(p)}
                target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', background: '#7F77DD', color: '#fff',
                  borderRadius: 9, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                <Navigation size={12} /> Ir
              </a>
            </div>
          ))}

          {/* Footer con enlace a Maps */}
          {pharmacies.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <a href={mapsUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <ExternalLink size={12} /> Ver todas en Google Maps
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Escáner ────────────────────────────────────────────────────────────

const SCANNER_ID = 'medication-barcode-scanner'

function MedicationBarcodeScanner({
  onFound,
  onClose,
}: {
  onFound: (d: { name?: string; brand?: string; barcode?: string; barcodeIsNew?: boolean }) => void
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
              const d = await api.get<any>(`/product/${code}`)
              if (d?.name) { setProduct(d); setStatus('found') }
              else setStatus('notfound')
            } catch { setStatus('notfound') }
          },
          () => {}
        )
      } catch (e: any) {
        if (!stopped) { setErrorMsg(e.message ?? 'No se pudo acceder a la cámara'); setStatus('error') }
      }
    }
    start()
    return () => { stopped = true; scannerRef.current?.stop().catch(() => {}) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: 460, maxWidth: '95vw', overflow: 'hidden' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScanLine size={18} style={{ color: '#7F77DD' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Escanear medicamento</span>
          </div>
          <button onClick={() => { scannerRef.current?.stop().catch(() => {}); onClose() }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {status === 'scanning' && (
          <div>
            <div id={SCANNER_ID} style={{ width: '100%', background: '#000' }} />
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0', margin: 0 }}>
              Centra el código de barras en el recuadro
            </p>
          </div>
        )}

        {status === 'found' && product && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
              {product.imageUrl && (
                <img src={product.imageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 4, flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>✅ {product.name}</div>
                {product.brand && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{product.brand}</div>}
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginTop: 4 }}>{barcode}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
              Podrás añadir dosis, frecuencia y fecha de caducidad en el paso siguiente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ ...scBtnSec, flex: 1 }}>Cancelar</button>
              <button onClick={() => onFound({ ...product, barcode, barcodeIsNew: false })} style={{ ...scBtnPri, flex: 2 }}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {status === 'notfound' && (
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>🩺 Medicamento no reconocido</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', marginBottom: 12 }}>Código: {barcode}</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
              No está en nuestra base de datos. Escríbelo tú y lo guardamos — la próxima vez se reconocerá solo.
            </p>
            <label style={scLbl}>Nombre del medicamento</label>
            <input autoFocus value={manualName} onChange={e => setManualName(e.target.value)}
              placeholder="Ej: Ibuprofeno 400mg, Enantyum, Dalsy..." style={scInp} />
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

// ── Formulario de edición ──────────────────────────────────────────────

function MedicationEditForm({ item, onSave, onCancel, loading }: {
  item: Medication
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  loading: boolean
}) {
  const [form, setForm] = useState({
    name:           item.name,
    quantity:       String(item.quantity),
    unit:           item.unit,
    dosisDesc:      item.dosisDesc ?? '',
    frecuenciaToma: item.frecuenciaToma ?? '',
    notes:          item.notes ?? '',
    expiryDate:     item.expiryDate ? item.expiryDate.split('T')[0] : '',
  })

  function handleSave() {
    onSave({
      name:           form.name.trim(),
      quantity:       parseFloat(form.quantity) || item.quantity,
      unit:           form.unit,
      dosisDesc:      form.dosisDesc || null,
      frecuenciaToma: form.frecuenciaToma || null,
      notes:          form.notes || null,
      expiryDate:     form.expiryDate || null,
    })
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid #7F77DD',
      borderRadius: 14, padding: '18px 20px', marginTop: 6,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#7F77DD', marginBottom: 14 }}>
        ✏️ Editar medicamento
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Nombre</label>
          <input autoFocus value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={inp} />
        </div>
        <div>
          <label style={labelStyle}>Cantidad</label>
          <input type="number" min="0" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            style={inp} />
        </div>
        <div>
          <label style={labelStyle}>Unidad</label>
          <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
            {UNIT_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Dosis</label>
          <input value={form.dosisDesc}
            onChange={e => setForm(f => ({ ...f, dosisDesc: e.target.value }))}
            placeholder="Ej: 1 comprimido cada 8h"
            style={inp} />
        </div>
        <div>
          <label style={labelStyle}>Frecuencia</label>
          <select value={form.frecuenciaToma} onChange={e => setForm(f => ({ ...f, frecuenciaToma: e.target.value }))} style={inp}>
            <option value="">Sin especificar</option>
            {FRECUENCIA_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Fecha de caducidad</label>
          <input type="date" value={form.expiryDate}
            onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
            style={{ ...inp, colorScheme: 'dark' }} />
        </div>
        <div>
          <label style={labelStyle}>Notas</label>
          <input value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notas opcionales"
            style={inp} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSec}>Cancelar</button>
        <button onClick={handleSave} disabled={!form.name.trim() || loading}
          style={{ ...btnPrimary, opacity: (!form.name.trim() || loading) ? 0.6 : 1 }}>
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ── Estilos ────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', background: '#7F77DD', color: '#fff',
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
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const scLbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }
const scInp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
  fontSize: 14, marginBottom: 4, boxSizing: 'border-box', outline: 'none',
}
const scBtnPri: React.CSSProperties = { padding: '11px', background: '#7F77DD', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const scBtnSec: React.CSSProperties = { padding: '11px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }
