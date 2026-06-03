import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ShoppingCart, Trash2 } from 'lucide-react'

interface Item {
  id: string; name: string; quantity: number; unit: string
  daysUntilExpiry?: number; zone?: { name: string; icon: string }
}

export function AlertsPage() {
  const qc = useQueryClient()

  const { data: expiring } = useQuery<{ data: Item[] }>({
    queryKey: ['alerts', 'expiring'],
    queryFn: () => api.get('/items?expiringSoon=true&limit=50&sort=expiryDate&order=asc'),
    refetchInterval: 60_000,
  })

  const { data: expired } = useQuery<{ data: Item[] }>({
    queryKey: ['alerts', 'expired'],
    queryFn: () => api.get('/items?expired=true&limit=50&sort=expiryDate&order=asc'),
    refetchInterval: 60_000,
  })

  const discard = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['summary'] }) },
  })

  const addToShopping = useMutation({
    mutationFn: (item: Item) => api.post('/shopping', { name: item.name, quantity: 1, unit: item.unit }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const expiringItems = expiring?.data ?? []
  const expiredItems = expired?.data ?? []
  const total = expiringItems.length + expiredItems.length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Alertas de caducidad</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          {total === 0 ? 'Todo en orden — no hay alertas activas 🎉' : `${total} producto${total > 1 ? 's' : ''} requieren atención`}
        </p>
      </div>

      {expiredItems.length > 0 && (
        <Section title="🚨 Caducados" color="var(--danger)">
          {expiredItems.map(item => (
            <AlertRow key={item.id} item={item} label="Caducado" color="var(--danger)"
              onDiscard={() => discard.mutate(item.id)}
              onAddToShopping={() => addToShopping.mutate(item)} />
          ))}
        </Section>
      )}

      {expiringItems.length > 0 && (
        <Section title="⚠️ Caducan pronto" color="var(--warning)">
          {expiringItems.map(item => {
            const days = item.daysUntilExpiry
            const label = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`
            const color = days! <= 1 ? 'var(--warning)' : 'var(--teal)'
            return (
              <AlertRow key={item.id} item={item} label={label} color={color}
                onDiscard={() => discard.mutate(item.id)}
                onAddToShopping={() => addToShopping.mutate(item)} />
            )
          })}
        </Section>
      )}

      {total === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
            Despensa perfecta
          </p>
          <p style={{ fontSize: 14, margin: 0 }}>Nada caduca en los próximos 7 días</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color, margin: '0 0 12px' }}>{title}</h2>
      <div style={{ background: 'var(--surface)', border: `1px solid ${color}40`, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function AlertRow({ item, label, color, onDiscard, onAddToShopping }: {
  item: Item; label: string; color: string
  onDiscard: () => void; onAddToShopping: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
          {item.zone ? `${item.zone.icon} ${item.zone.name} · ` : ''}
          {item.quantity} {item.unit}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}18`, borderRadius: 20, padding: '3px 12px' }}>
          {label}
        </span>
        <button onClick={onAddToShopping} title="Añadir a lista" style={actionBtn('var(--teal)')}>
          <ShoppingCart size={14} />
        </button>
        <button onClick={onDiscard} title="Descartar" style={actionBtn('var(--danger)')}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function actionBtn(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
    background: `${color}15`, border: `1px solid ${color}40`, color,
  }
}
