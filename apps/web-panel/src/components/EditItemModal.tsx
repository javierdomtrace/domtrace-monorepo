import React, { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { X, Plus, Minus } from 'lucide-react'

interface Zone { id: string; name: string; icon: string }
interface Item {
  id: string; name: string; quantity: number; unit: string
  expiryDate?: string; zoneId?: string; zone?: { id: string; name: string; icon: string }
  status: string
}

interface EditItemModalProps {
  item: Item
  onClose: () => void
}

const UNITS = ['u', 'kg', 'g', 'l', 'ml', 'cl', 'pack', 'caja', 'bote', 'lata']

export function EditItemModal({ item, onClose }: EditItemModalProps) {
  const qc = useQueryClient()

  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [unit, setUnit] = useState(item.unit)
  const [zoneId, setZoneId] = useState(item.zone?.id ?? '')
  const [expiryDate, setExpiryDate] = useState(
    item.expiryDate ? item.expiryDate.split('T')[0] : ''
  )
  const [error, setError] = useState('')

  const { data: zones } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => api.get('/pantry/zones'),
  })

  const save = useMutation({
    mutationFn: () => api.put(`/items/${item.id}`, {
      name,
      quantity: parseFloat(quantity) || 1,
      unit,
      zoneId: zoneId || undefined,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['zones'] })
      onClose()
    },
    onError: (err: any) => setError(err.message),
  })

  const adjustQty = (delta: number) => {
    const current = parseFloat(quantity) || 0
    const next = Math.max(0.1, current + delta)
    setQuantity(String(Math.round(next * 10) / 10))
  }

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    modalRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="edit-item-title" tabIndex={-1} style={{
        background: '#1A1A2E', border: '1px solid #2A2A3E',
        borderRadius: 16, padding: 28, width: 440, maxWidth: '95vw',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 id="edit-item-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#F0F0F5' }}>Editar producto</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Nombre */}
        <label style={lbl}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inp} />

        {/* Cantidad con +/- */}
        <label style={lbl}>Cantidad</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <button onClick={() => adjustQty(-1)} style={qtyBtn}><Minus size={14} /></button>
          <input
            type="number" min="0.1" step="0.1"
            value={quantity} onChange={e => setQuantity(e.target.value)}
            style={{ ...inp, flex: 1, marginBottom: 0, textAlign: 'center' }}
          />
          <button onClick={() => adjustQty(1)} style={qtyBtn}><Plus size={14} /></button>
          <select value={unit} onChange={e => setUnit(e.target.value)}
            style={{ ...inp, marginBottom: 0, width: 80, cursor: 'pointer' }}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Zona */}
        <label style={lbl}>Zona</label>
        <select value={zoneId} onChange={e => setZoneId(e.target.value)}
          style={{ ...inp, cursor: 'pointer' }}>
          <option value="">Sin zona</option>
          {zones?.map(z => <option key={z.id} value={z.id}>{z.icon} {z.name}</option>)}
        </select>

        {/* Caducidad */}
        <label style={lbl}>Fecha de caducidad</label>
        <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
          style={{ ...inp, colorScheme: 'dark' }} />

        {error && <p style={{ color: '#FF6B6B', fontSize: 13, margin: '4px 0 0' }}>{error}</p>}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={() => save.mutate()} disabled={!name || save.isPending}
            style={{ ...btnPri, opacity: !name || save.isPending ? 0.5 : 1 }}>
            {save.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0F0F1A',
  border: '1px solid #2A2A3E', borderRadius: 10,
  color: '#F0F0F5', fontSize: 14, marginBottom: 14,
  boxSizing: 'border-box', outline: 'none',
}
const qtyBtn: React.CSSProperties = {
  width: 36, height: 38, borderRadius: 8, border: '1px solid #2A2A3E',
  background: '#0F0F1A', color: '#4ECDC4', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
const btnPri: React.CSSProperties = { flex: 2, padding: '12px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnSec: React.CSSProperties = { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #2A2A3E', borderRadius: 10, color: '#888', fontSize: 14, cursor: 'pointer' }
