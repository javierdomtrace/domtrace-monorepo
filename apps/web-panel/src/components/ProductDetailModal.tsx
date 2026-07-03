/**
 * Modal de detalle de producto para el panel web.
 * Equivalente a apps/mobile/app/product/[id].tsx
 *
 * Uso:
 *   <ProductDetailModal itemId="abc123" onClose={() => setDetailId(null)} />
 */
import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '../lib/api'
import { useWebVoiceGuide } from '../lib/voice-guide'

interface Movement {
  id: string
  type: string
  quantity: number
  createdAt: string
}

interface ItemDetail {
  id: string
  name: string
  barcode?: string
  lotNumber?: string
  expiryDate?: string | null
  quantity: number
  unit: string
  daysUntilExpiry?: number
  allergens: string[]
  notes?: string
  zone?: { id: string; name: string; icon: string } | null
  tags?: Array<{ id: string; name: string }>
  movements?: Movement[]
  conservacion?: string
  tipoFresco?: string
  bodega?: string
  anada?: number
  varietal?: string
  denominacion?: string
  valoracion?: number
  notasCata?: string
  createdAt: string
}

const MOVEMENT_LABELS: Record<string, string> = {
  IN:       '📦 Entrada',
  OUT:      '✓ Consumido',
  DISCARD:  '✕ Descartado',
  MOVE:     '📍 Movido',
  DONATION: '🤝 Donado',
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function daysColor(days?: number): string {
  if (days === undefined) return 'var(--muted)'
  if (days <= 0) return 'var(--danger)'
  if (days <= 3) return 'var(--danger)'
  if (days <= 7) return 'var(--warning)'
  return 'var(--teal)'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '9px 0', borderBottom: '1px solid var(--border)', gap: 16,
    }}>
      <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 16, marginBottom: 12,
    }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
      )}
      {children}
    </div>
  )
}

interface Props {
  itemId: string
  onClose: () => void
}

export function ProductDetailModal({ itemId, onClose }: Props) {
  const qc = useQueryClient()

  const { data: item, isLoading } = useQuery<ItemDetail>({
    queryKey: ['item', itemId],
    queryFn: () => api.get<ItemDetail>(`/items/${itemId}`),
    enabled: !!itemId,
  })

  const voiceText = item
    ? `${item.name}. ${item.quantity} ${item.unit}${item.zone ? ` en ${item.zone.name}` : ''}.${item.daysUntilExpiry !== undefined ? item.daysUntilExpiry <= 0 ? ' Este producto ya ha caducado.' : ` Caduca en ${item.daysUntilExpiry} días.` : ''}${item.allergens?.length ? ` Contiene: ${item.allergens.join(', ')}.` : ''}`
    : undefined

  const { stop, toggle, speaking } = useWebVoiceGuide(voiceText)

  const consume = useMutation({
    mutationFn: () => api.patch(`/items/${itemId}/consume`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['item', itemId] })
      onClose()
    },
  })

  const discard = useMutation({
    mutationFn: () => api.patch(`/items/${itemId}/discard`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      onClose()
    },
  })

  const handleClose = () => { stop(); onClose() }

  const dc = item ? daysColor(item.daysUntilExpiry) : 'var(--muted)'

  return (
    /* Backdrop */
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)', borderRadius: 16, width: '100%', maxWidth: 560,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)',
        }}
      >
        {/* Cabecera */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            title="Cerrar"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
            Detalle del producto
          </span>

          {/* Botón de voz */}
          <button
            onClick={() => voiceText && toggle(voiceText)}
            title={speaking ? 'Parar lectura' : 'Leer en voz alta'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
              background: speaking ? 'rgba(78,205,196,0.15)' : 'var(--surface)',
              color: speaking ? 'var(--teal)' : 'var(--text)', cursor: 'pointer',
              fontSize: 16,
            }}
          >
            {speaking ? '⏹' : '🔊'}
          </button>
        </div>

        {/* Contenido con scroll */}
        <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
          {isLoading || !item ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
              Cargando...
            </div>
          ) : (
            <>
              {/* Nombre */}
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 12, lineHeight: 1.3 }}>
                {item.name}
              </div>

              {/* Pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {item.zone && (
                  <span style={{
                    background: 'rgba(29,158,117,0.15)', borderRadius: 20, padding: '4px 12px',
                    border: '1px solid var(--teal)', color: 'var(--teal)', fontSize: 13, fontWeight: 700,
                  }}>
                    {item.zone.icon} {item.zone.name}
                  </span>
                )}
                {item.daysUntilExpiry !== undefined && (
                  <span style={{
                    borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700,
                    background: `${dc}20`, border: `1px solid ${dc}`, color: dc,
                  }}>
                    {item.daysUntilExpiry <= 0 ? '¡Caducado!' : `Caduca en ${item.daysUntilExpiry}d`}
                  </span>
                )}
              </div>

              {/* Info principal */}
              <SectionCard title="">
                <InfoRow label="Cantidad" value={`${item.quantity} ${item.unit}`} />
                <InfoRow label="Código de barras" value={item.barcode ?? '—'} />
                <InfoRow label="Lote" value={item.lotNumber ?? '—'} />
                <InfoRow label="Fecha de caducidad" value={formatDate(item.expiryDate)} />
                {item.allergens?.length > 0 && (
                  <InfoRow label="Alérgenos" value={item.allergens.join(', ')} />
                )}
                {item.notes && <InfoRow label="Notas" value={item.notes} />}
                <InfoRow label="Añadido el" value={formatDate(item.createdAt)} />
              </SectionCard>

              {/* Sección vino */}
              {(item.bodega || item.anada || item.varietal) && (
                <SectionCard title="🍷 Vino">
                  {item.bodega && <InfoRow label="Bodega" value={item.bodega} />}
                  {item.anada && <InfoRow label="Añada" value={String(item.anada)} />}
                  {item.varietal && <InfoRow label="Varietal" value={item.varietal} />}
                  {item.denominacion && <InfoRow label="D.O." value={item.denominacion} />}
                  {item.valoracion !== undefined && (
                    <InfoRow
                      label="Valoración"
                      value={`${'★'.repeat(Math.round(item.valoracion))}${'☆'.repeat(5 - Math.round(item.valoracion))} (${item.valoracion}/5)`}
                    />
                  )}
                  {item.notasCata && <InfoRow label="Notas de cata" value={item.notasCata} />}
                </SectionCard>
              )}

              {/* Conservación */}
              {item.conservacion && (
                <SectionCard title="🌱 Conservación">
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>
                    {item.conservacion}
                  </p>
                </SectionCard>
              )}

              {/* Historial de movimientos */}
              {item.movements && item.movements.length > 0 && (
                <SectionCard title="Historial">
                  {item.movements.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                        {m.quantity !== 0 && (
                          <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                            ×{m.quantity}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(m.createdAt)}</span>
                    </div>
                  ))}
                </SectionCard>
              )}

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Marcar "${item.name}" como consumido?`)) consume.mutate()
                  }}
                  disabled={consume.isPending}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12,
                    background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.3)',
                    color: 'var(--teal)', fontSize: 14, fontWeight: 700,
                    cursor: consume.isPending ? 'not-allowed' : 'pointer',
                    opacity: consume.isPending ? 0.5 : 1,
                  }}
                >
                  ✓ Consumido
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Descartar "${item.name}"?`)) discard.mutate()
                  }}
                  disabled={discard.isPending}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 12,
                    background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)',
                    color: 'var(--danger)', fontSize: 14, fontWeight: 700,
                    cursor: discard.isPending ? 'not-allowed' : 'pointer',
                    opacity: discard.isPending ? 0.5 : 1,
                  }}
                >
                  ✕ Descartar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
