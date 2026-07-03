import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'
import { AlertTriangle, Package, ShoppingCart, TrendingDown, Heart } from 'lucide-react'
import { useWebVoiceGuide } from '../lib/voice-guide'

interface Summary {
  total: number
  expiringSoon: number
  expired: number
  zones: Array<{ id: string; name: string; icon: string; itemCount: number }>
}

interface Item {
  id: string; name: string; quantity: number; unit: string
  expiryDate?: string; daysUntilExpiry?: number; status: string
  zone?: { name: string; icon: string }
}

function buildVoiceText(summary: Summary | undefined, name: string | undefined): string {
  if (!summary) return ''
  const first = name?.split(' ')[0] ?? ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  let text = `${saludo}${first ? `, ${first}` : ''}. Tienes ${summary.total} productos en la despensa.`
  if (summary.expiringSoon > 0) text += ` ${summary.expiringSoon} caducan pronto.`
  if (summary.expired > 0) text += ` ${summary.expired} ya han caducado.`
  if (summary.zones.length > 0) {
    text += ' Por zonas: ' + summary.zones.map(z => `${z.name}, ${z.itemCount} productos`).join('. ') + '.'
  }
  return text
}

export function DashboardPage() {
  const user = useAuth(s => s.user)
  const [zonesExpanded, setZonesExpanded] = useState(false)

  const { data: summary } = useQuery<Summary>({
    queryKey: ['summary'],
    queryFn: () => api.get('/pantry/summary'),
    refetchInterval: 60_000,
  })

  const { data: expiring } = useQuery<{ data: Item[] }>({
    queryKey: ['items', 'expiring'],
    queryFn: () => api.get('/items?expiringSoon=true&limit=5&sort=expiryDate&order=asc'),
  })

  const { data: shopping } = useQuery<{ data: any[] }>({
    queryKey: ['shopping'],
    queryFn: () => api.get('/shopping'),
  })

  const { data: pendingDonation } = useQuery<any>({
    queryKey: ['pending-donation'],
    queryFn: () => api.get('/items/pending-donation'),
    refetchInterval: 60_000,
  })

  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  const voiceText = buildVoiceText(summary, user?.name)
  const { toggle, speaking } = useWebVoiceGuide(voiceText)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
            {saludo}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Esto es lo que tienes en casa ahora mismo.
          </p>
        </div>

        {/* Botón de voz */}
        <button
          onClick={() => voiceText && toggle(voiceText)}
          title={speaking ? 'Parar lectura' : 'Leer resumen en voz alta'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)',
            background: speaking ? 'rgba(78,205,196,0.15)' : 'var(--surface)',
            color: speaking ? 'var(--teal)' : 'var(--text)', cursor: 'pointer',
            fontSize: 18, flexShrink: 0, marginTop: 2,
          }}
          aria-label={speaking ? 'Parar lectura de voz' : 'Leer resumen en voz alta'}
        >
          {speaking ? '⏹' : '🔊'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: zonesExpanded ? 0 : 32 }}>
        {/* StatCard "Productos" — clickable, expande el desglose por zona */}
        <StatCard
          icon={<Package size={20} />}
          label="Productos"
          value={summary?.total ?? 0}
          color="var(--teal)"
          onClick={() => setZonesExpanded(v => !v)}
          expanded={zonesExpanded}
          clickable
        />
        <StatCard icon={<AlertTriangle size={20} />} label="Caducan pronto" value={summary?.expiringSoon ?? 0} color="var(--warning)" />
        <StatCard icon={<TrendingDown size={20} />} label="Caducados" value={summary?.expired ?? 0} color="var(--danger)" />
        <StatCard icon={<ShoppingCart size={20} />} label="En lista" value={shopping?.data?.length ?? 0} color="#A78BFA" />
      </div>

      {/* Panel expandible de zonas (inline, debajo de los stats) */}
      {zonesExpanded && summary?.zones && summary.zones.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 12px 12px', marginBottom: 32,
          padding: '0 20px 4px',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            {summary.zones.map(z => (
              <div key={z.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
                width: '100%',
              }}>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>
                  <span style={{ marginRight: 8 }}>{z.icon}</span>{z.name}
                </span>
                <span style={{
                  background: 'rgba(78,205,196,0.12)', color: 'var(--teal)',
                  borderRadius: 20, fontSize: 12, fontWeight: 700, padding: '3px 12px',
                }}>
                  {z.itemCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Urgentes */}
        <Card title="⚠️ Caducan esta semana">
          {!expiring?.data?.length
            ? <Empty text="Todo en orden — nada urgente esta semana 🎉" />
            : expiring.data.map(item => <ExpiringRow key={item.id} item={item} />)
          }
        </Card>

        {/* Zonas */}
        <Card title="📦 Zonas de la despensa">
          {!summary?.zones?.length
            ? <Empty text="Sin zonas configuradas" />
            : summary.zones.map(z => (
              <div key={z.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>{z.icon} {z.name}</span>
                <span style={{
                  background: 'rgba(78,205,196,0.12)', color: 'var(--teal)',
                  borderRadius: 20, fontSize: 12, fontWeight: 600, padding: '2px 10px',
                }}>
                  {z.itemCount} productos
                </span>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Donaciones pendientes */}
      {(() => {
        const items = Array.isArray(pendingDonation) ? pendingDonation : (pendingDonation?.data ?? [])
        if (!items.length) return null
        return (
          <div style={{ marginTop: 24 }}>
            <Card title="🏦 Pendiente de llevar al Banco de Alimentos">
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
                Estos productos están apartados para donar. Cuando los lleves, márcalos como entregados.
              </p>
              {items.map((item: any) => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {item.quantity} {item.unit}
                      {item.daysUntilExpiry !== undefined && ` · caduca en ${item.daysUntilExpiry} días`}
                    </div>
                  </div>
                  <DonationConfirmBtn itemId={item.id} />
                </div>
              ))}
            </Card>
          </div>
        )
      })()}
    </div>
  )
}

function DonationConfirmBtn({ itemId }: { itemId: string }) {
  const qc = useQueryClient()
  const confirm = useMutation({
    mutationFn: () => api.patch(`/items/${itemId}/donate-confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-donation'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
    },
  })
  return (
    <button onClick={() => confirm.mutate()} disabled={confirm.isPending} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)',
      borderRadius: 8, color: '#1D9E75', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>
      <Heart size={12} /> {confirm.isPending ? '...' : 'Ya lo entregué'}
    </button>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  onClick?: () => void
  expanded?: boolean
  clickable?: boolean
}

function StatCard({ icon, label, value, color, onClick, expanded, clickable }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${expanded ? color : 'var(--border)'}`,
        borderBottomColor: expanded ? 'var(--surface)' : undefined,
        borderRadius: expanded ? '12px 12px 0 0' : 12,
        padding: 20,
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ color }}>{icon}</div>
        {clickable && (
          <span style={{ fontSize: 11, color: expanded ? color : 'var(--muted)', fontWeight: 600 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{text}</p>
}

function ExpiringRow({ item }: { item: Item }) {
  const days = item.daysUntilExpiry
  const color = days === undefined ? 'var(--muted)' : days <= 0 ? 'var(--danger)' : days <= 2 ? 'var(--warning)' : 'var(--teal)'
  const label = days === undefined ? '—' : days <= 0 ? 'Caducado' : days === 1 ? 'Mañana' : `${days} días`

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.zone?.icon} {item.zone?.name ?? 'Sin zona'}</div>
      </div>
      <span style={{
        fontSize: 12, fontWeight: 700, color, background: `${color}18`,
        borderRadius: 20, padding: '3px 10px',
      }}>
        {label}
      </span>
    </div>
  )
}
