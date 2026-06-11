import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { Search, Plus, Trash2, CheckCircle, ScanLine, Pencil, Heart } from 'lucide-react'
import { AddItemModal } from '../components/AddItemModal'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { EditItemModal } from '../components/EditItemModal'
import { ProductInfoPanel } from '../components/ProductInfoPanel'
import { Leaf } from 'lucide-react'

interface Item {
  id: string; name: string; quantity: number; unit: string
  expiryDate?: string; daysUntilExpiry?: number; status: string
  pendienteDonacion?: boolean; barcode?: string
  tipoFresco?: string; fechaCompra?: string; vidaUtilDias?: number; conservacion?: string
  allergens: string[]; zone?: { id: string; name: string; icon: string }
}

interface Zone { id: string; name: string; icon: string; temperatureType: string; itemCount: number }

export function PantryPage() {
  const qc = useQueryClient()
  const activeHouseholdId = useAuth(s => s.user?.activeHouseholdId)
  const [search, setSearch] = useState('')
  const [activeZone, setActiveZone] = useState<string | 'all' | 'frescos'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)

  const { data: zonesData } = useQuery<Zone[]>({
    queryKey: ['zones', activeHouseholdId],
    queryFn: () => api.get('/pantry/zones'),
  })

  const { data: itemsData, isLoading } = useQuery<any>({
    queryKey: ['items', activeZone, search, activeHouseholdId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100', sort: 'expiryDate', order: 'asc' })
      if (activeZone !== 'all' && activeZone !== 'frescos') params.set('zoneId', activeZone)
      if (search) params.set('q', search)
      return api.get(`/items?${params}`)
    },
  })

  const consume = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/consume`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); qc.invalidateQueries({ queryKey: ['summary'] }) },
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); qc.invalidateQueries({ queryKey: ['summary'] }) },
  })

  const donate = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/donate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['pending-donation'] })
    },
  })

  const allItems: Item[] = Array.isArray(itemsData) ? itemsData : (itemsData?.data ?? [])
  const items: Item[] = activeZone === 'frescos'
    ? allItems.filter(i => !!i.tipoFresco)
    : allItems
  const frescoCount = allItems.filter(i => !!i.tipoFresco).length
  const zones = zonesData ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Despensa</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...btnPrimary, background: 'var(--surface2, #22223B)', color: '#4ECDC4', border: '1px solid #2A2A3E' }}
            onClick={() => setShowScanner(true)}>
            <ScanLine size={16} /> Escanear
          </button>
          <button style={btnPrimary} onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>

      {showAddModal && <AddItemModal onClose={() => setShowAddModal(false)} />}
      {showScanner && <BarcodeScanner onClose={() => setShowScanner(false)} />}
      {editItem && <EditItemModal item={editItem} onClose={() => setEditItem(null)} />}

      {/* Filtros por zona */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <ZoneChip active={activeZone === 'all'} onClick={() => setActiveZone('all')} label="Todos" count={allItems.length} />
        {frescoCount > 0 && (
          <ZoneChip
            active={activeZone === 'frescos'}
            onClick={() => setActiveZone('frescos')}
            label="🌱 Frescos"
            count={frescoCount}
            green
          />
        )}
        {zones.map(z => (
          <ZoneChip key={z.id} active={activeZone === z.id}
            onClick={() => setActiveZone(z.id)} label={`${z.icon} ${z.name}`} count={z.itemCount} />
        ))}
      </div>

      {/* Búsqueda */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          style={{
            width: '100%', padding: '10px 14px 10px 40px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
            fontSize: 14, boxSizing: 'border-box', outline: 'none',
          }}
        />
      </div>

      {/* Tabla */}
      {isLoading
        ? <p style={{ color: 'var(--muted)' }}>Cargando...</p>
        : !items.length
          ? <Empty />
          : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Producto', 'Zona', 'Cantidad', 'Caduca', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => <ItemRow key={item.id} item={item} onConsume={() => consume.mutate(item.id)} onDiscard={() => discard.mutate(item.id)} onEdit={() => setEditItem(item)} onDonate={() => donate.mutate(item.id)} />)}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  )
}

function FreshnessBar({ item }: { item: Item }) {
  if (!item.tipoFresco || !item.fechaCompra || !item.vidaUtilDias) return null
  const diasDesdeCompra = Math.floor((Date.now() - new Date(item.fechaCompra).getTime()) / 86400000)
  const diasRestantes = Math.max(0, item.vidaUtilDias - diasDesdeCompra)
  const pct = Math.min(100, Math.round((diasDesdeCompra / item.vidaUtilDias) * 100))
  const color = pct >= 90 ? '#E24B4A' : pct >= 70 ? '#EF9F27' : pct >= 40 ? '#FFD166' : '#1D9E75'
  const estado = pct >= 100 ? '⚠️ Usar ya' : pct >= 70 ? '⏰ Usar pronto' : '✅ Fresco'

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{estado}</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          {diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Sin días restantes'}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 2, transition: 'width 0.3s',
        }} />
      </div>
      {item.conservacion && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, fontStyle: 'italic' }}>
          💡 {item.conservacion}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onConsume, onDiscard, onEdit, onDonate }: { item: Item; onConsume: () => void; onDiscard: () => void; onEdit: () => void; onDonate: () => void }) {
  const days = item.daysUntilExpiry
  const isFresco = !!item.tipoFresco

  // Para frescos: calcular estado por días desde compra
  const diasDesdeCompra = isFresco && item.fechaCompra
    ? Math.floor((Date.now() - new Date(item.fechaCompra).getTime()) / 86400000)
    : undefined
  const vidaUtil = item.vidaUtilDias ?? 7
  const diasRestantesFresco = diasDesdeCompra !== undefined ? Math.max(0, vidaUtil - diasDesdeCompra) : undefined
  const pctFresco = diasDesdeCompra !== undefined ? Math.min(100, Math.round((diasDesdeCompra / vidaUtil) * 100)) : 0

  const expiryColor = isFresco
    ? (pctFresco >= 90 ? 'var(--danger)' : pctFresco >= 70 ? 'var(--warning)' : '#1D9E75')
    : (days === undefined ? 'var(--muted)' : days <= 0 ? 'var(--danger)' : days <= 2 ? 'var(--warning)' : days <= 7 ? '#FFD166' : 'var(--teal)')

  const expiryLabel = isFresco
    ? (diasRestantesFresco === 0 ? '⚠️ Usar ya' : diasRestantesFresco === 1 ? '🌱 1 día' : `🌱 ${diasRestantesFresco}d`)
    : (days === undefined ? '—' : days <= 0 ? 'Caducado' : days === 1 ? 'Mañana' : `${days} días`)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', opacity: item.pendienteDonacion ? 0.75 : 1 }}>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
          {isFresco && <Leaf size={12} color="#3B6D11" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />}
          {item.name}
          {item.pendienteDonacion && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#3B6D11', background: 'rgba(59,109,17,0.12)', borderRadius: 10, padding: '2px 8px' }}>
              🏦 Apartado para donar
            </span>
          )}
        </div>
        {item.allergens.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>⚠️ {item.allergens.join(', ')}</div>
        )}
        {isFresco && <FreshnessBar item={item} />}
        {item.barcode && !isFresco && (
          <ProductInfoPanel barcode={item.barcode} />
        )}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>
        {item.zone ? `${item.zone.icon} ${item.zone.name}` : '—'}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)' }}>
        {item.quantity} {item.unit}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: expiryColor, background: `${expiryColor}18`, borderRadius: 20, padding: '3px 10px' }}>
          {expiryLabel}
        </span>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ActionBtn onClick={onEdit} icon={<Pencil size={14} />} label="Editar" color="#7F77DD" />
          <ActionBtn onClick={onConsume} icon={<CheckCircle size={14} />} label="Consumir" color="var(--teal)" />
          {!item.pendienteDonacion
            ? <ActionBtn onClick={onDonate} icon={<Heart size={14} />} label="Donar" color="#3B6D11" />
            : <ActionBtn onClick={onDonate} icon={<Heart size={14} />} label="Donado ✓" color="#3B6D11" />
          }
          <ActionBtn onClick={onDiscard} icon={<Trash2 size={14} />} label="Tirar" color="var(--danger)" />
        </div>
      </td>
    </tr>
  )
}

function ZoneChip({ active, onClick, label, count, green }: { active: boolean; onClick: () => void; label: string; count: number; green?: boolean }) {
  const accent = green ? '#3B6D11' : 'var(--teal)'
  const activeBg = green ? 'rgba(59,109,17,0.12)' : 'rgba(78,205,196,0.12)'
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: green ? 700 : 500, cursor: 'pointer',
      border: active ? `1px solid ${accent}` : `1px solid ${green ? 'rgba(59,109,17,0.4)' : 'var(--border)'}`,
      background: active ? activeBg : green ? 'rgba(59,109,17,0.05)' : 'var(--surface)',
      color: active ? accent : green ? '#3B6D11' : 'var(--muted)',
    }}>
      {label} <span style={{ opacity: 0.6 }}>({count})</span>
    </button>
  )
}

function ActionBtn({ onClick, icon, label, color }: { onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
      background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 8,
      color, fontSize: 12, cursor: 'pointer', fontWeight: 500,
    }}>
      {icon} {label}
    </button>
  )
}

function Empty() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🥫</div>
      <p style={{ margin: 0, fontSize: 15 }}>La despensa está vacía</p>
      <p style={{ margin: '6px 0 0', fontSize: 13 }}>Añade productos o escanea una etiqueta NFC</p>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
  background: 'var(--teal)', color: '#0F0F1A', border: 'none', borderRadius: 10,
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
