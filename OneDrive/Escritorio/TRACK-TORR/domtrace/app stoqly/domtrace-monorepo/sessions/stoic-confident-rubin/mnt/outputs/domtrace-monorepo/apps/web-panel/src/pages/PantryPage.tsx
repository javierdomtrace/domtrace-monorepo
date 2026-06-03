import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Search, Plus, Trash2, CheckCircle } from 'lucide-react'

interface Item {
  id: string; name: string; quantity: number; unit: string
  expiryDate?: string; daysUntilExpiry?: number; status: string
  allergens: string[]; zone?: { id: string; name: string; icon: string }
}

interface Zone { id: string; name: string; icon: string; temperatureType: string; itemCount: number }

export function PantryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeZone, setActiveZone] = useState<string | 'all'>('all')

  const { data: zonesData } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => api.get('/pantry/zones'),
  })

  const { data: itemsData, isLoading } = useQuery<{ data: Item[] }>({
    queryKey: ['items', activeZone, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100', sort: 'expiryDate', order: 'asc' })
      if (activeZone !== 'all') params.set('zoneId', activeZone)
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

  const items = itemsData?.data ?? []
  const zones = zonesData ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Despensa</h1>
        <button style={btnPrimary}>
          <Plus size={16} /> Añadir producto
        </button>
      </div>

      {/* Filtros por zona */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <ZoneChip active={activeZone === 'all'} onClick={() => setActiveZone('all')} label="Todos" count={items.length} />
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
                  {items.map(item => <ItemRow key={item.id} item={item} onConsume={() => consume.mutate(item.id)} onDiscard={() => discard.mutate(item.id)} />)}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  )
}

function ItemRow({ item, onConsume, onDiscard }: { item: Item; onConsume: () => void; onDiscard: () => void }) {
  const days = item.daysUntilExpiry
  const expiryColor = days === undefined ? 'var(--muted)' : days <= 0 ? 'var(--danger)' : days <= 2 ? 'var(--warning)' : days <= 7 ? '#FFD166' : 'var(--teal)'
  const expiryLabel = days === undefined ? '—' : days <= 0 ? 'Caducado' : days === 1 ? 'Mañana' : `${days} días`

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{item.name}</div>
        {item.allergens.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>⚠️ {item.allergens.join(', ')}</div>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionBtn onClick={onConsume} icon={<CheckCircle size={15} />} label="Consumir" color="var(--teal)" />
          <ActionBtn onClick={onDiscard} icon={<Trash2 size={15} />} label="Descartar" color="var(--danger)" />
        </div>
      </td>
    </tr>
  )
}

function ZoneChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
      border: active ? '1px solid var(--teal)' : '1px solid var(--border)',
      background: active ? 'rgba(78,205,196,0.12)' : 'var(--surface)',
      color: active ? 'var(--teal)' : 'var(--muted)',
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
