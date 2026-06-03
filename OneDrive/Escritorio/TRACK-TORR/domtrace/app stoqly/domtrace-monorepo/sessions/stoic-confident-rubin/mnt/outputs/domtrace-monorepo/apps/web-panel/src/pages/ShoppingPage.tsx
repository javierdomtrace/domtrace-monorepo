import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Check, Trash2 } from 'lucide-react'

interface ShoppingItem {
  id: string; name: string; quantity: number; unit: string
  supermarket?: string; checked: boolean; addedBy: string
}

export function ShoppingPage() {
  const qc = useQueryClient()
  const [newItem, setNewItem] = useState('')
  const [adding, setAdding] = useState(false)

  const { data } = useQuery<{ data: ShoppingItem[]; grouped: Record<string, ShoppingItem[]> }>({
    queryKey: ['shopping'],
    queryFn: () => api.get('/shopping'),
    refetchInterval: 30_000,
  })

  const add = useMutation({
    mutationFn: (name: string) => api.post('/shopping', { name, quantity: 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shopping'] }); setNewItem(''); setAdding(false) },
  })

  const check = useMutation({
    mutationFn: (id: string) => api.patch(`/shopping/${id}/check`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shopping/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const clearChecked = useMutation({
    mutationFn: () => api.delete('/shopping/clear'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const grouped = data?.grouped ?? {}
  const allItems = data?.data ?? []
  const checkedCount = allItems.filter(i => i.checked).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Lista de la compra</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {allItems.length} productos · {checkedCount} ya en el carro
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {checkedCount > 0 && (
            <button onClick={() => clearChecked.mutate()} style={btnSecondary}>
              <Trash2 size={14} /> Limpiar marcados
            </button>
          )}
          <button onClick={() => setAdding(true)} style={btnPrimary}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>

      {/* Añadir ítem rápido */}
      {adding && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            autoFocus value={newItem} onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newItem) add.mutate(newItem); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Nombre del producto..."
            style={{
              flex: 1, padding: '10px 14px', background: 'var(--surface)',
              border: '1px solid var(--teal)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
            }}
          />
          <button onClick={() => newItem && add.mutate(newItem)} style={btnPrimary}>Añadir</button>
          <button onClick={() => setAdding(false)} style={btnSecondary}>Cancelar</button>
        </div>
      )}

      {/* Lista agrupada por supermercado */}
      {Object.entries(grouped).length === 0
        ? <EmptyList />
        : Object.entries(grouped).map(([supermarket, items]) => (
          <div key={supermarket} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🛒 {supermarket}
            </h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {items.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  opacity: item.checked ? 0.4 : 1, transition: 'opacity 0.2s',
                }}>
                  <button onClick={() => check.mutate(item.id)} style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                    border: item.checked ? 'none' : '2px solid var(--border)',
                    background: item.checked ? 'var(--teal)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.checked && <Check size={13} color="#0F0F1A" strokeWidth={3} />}
                  </button>
                  <span style={{
                    flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)',
                    textDecoration: item.checked ? 'line-through' : 'none',
                  }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {item.quantity} {item.unit}
                  </span>
                  {item.addedBy === 'stoqly' && (
                    <span style={{ fontSize: 11, color: 'var(--teal)', background: 'rgba(78,205,196,0.1)', borderRadius: 10, padding: '2px 8px' }}>
                      Stoqly
                    </span>
                  )}
                  <button onClick={() => remove.mutate(item.id)} style={{
                    background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                    padding: 4, display: 'flex', borderRadius: 6,
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}

function EmptyList() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🛒</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Lista vacía</p>
      <p style={{ fontSize: 14, margin: 0 }}>Añade productos o dile a Stoqly que los añada él</p>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  background: 'var(--teal)', color: '#0F0F1A', border: 'none',
  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)',
  borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
