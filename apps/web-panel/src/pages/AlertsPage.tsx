import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ShoppingCart, CheckCircle, Trash2, Heart, X, MapPin, AlertTriangle } from 'lucide-react'
import { vibrate } from '../lib/vibration'

interface Item {
  id: string; name: string; quantity: number; unit: string
  daysUntilExpiry?: number; zone?: { name: string; icon: string }
  status: string
}

interface Profile {
  user: { categoriasActivas?: string[]; codigoPostal?: string }
  household: any
}

// Bancos de Alimentos por provincia/CP (datos reales aproximados)
function getBancoAlimentos(codigoPostal?: string) {
  const provincia = codigoPostal ? parseInt(codigoPostal.substring(0, 2)) : null
  const bancos: Record<number, { nombre: string; direccion: string; horario: string; telefono: string }> = {
    28: { nombre: 'Banco de Alimentos de Madrid', direccion: 'C/ Téllez, 32, Madrid', horario: 'Lun-Vie 9:00-14:00', telefono: '91 530 19 02' },
    8:  { nombre: 'Banc dels Aliments de Barcelona', direccion: 'C/ Pallars, 71, Barcelona', horario: 'Lun-Vie 8:00-17:00', telefono: '93 300 82 93' },
    41: { nombre: 'Banco de Alimentos de Sevilla', direccion: 'Av. de la Borbolla, 3, Sevilla', horario: 'Lun-Jue 9:00-14:00', telefono: '95 423 42 51' },
    46: { nombre: 'Banco de Alimentos de Valencia', direccion: 'C/ Amadeo de Saboya, 2, Valencia', horario: 'Lun-Vie 9:00-13:30', telefono: '96 379 10 98' },
  }
  const banco = provincia ? (bancos[provincia] ?? bancos[28]) : bancos[28]
  return banco
}

function getFarmaciaSIGRE(codigoPostal?: string) {
  return {
    nombre: 'Farmacia más cercana con SIGRE',
    descripcion: 'Cualquier farmacia adherida al programa SIGRE tiene un contenedor naranja para medicamentos caducados',
    web: 'https://www.sigre.es/puntos-de-recogida/',
    cp: codigoPostal ?? '',
  }
}

export function AlertsPage() {
  const qc = useQueryClient()
  const [donationItem, setDonationItem] = useState<Item | null>(null)
  const [sigreItem, setSigreItem] = useState<Item | null>(null)
  const [actionItem, setActionItem] = useState<Item | null>(null)

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
  })

  const categorias = profile?.user?.categoriasActivas?.length ? profile.user.categoriasActivas : ['ALIMENTACION']
  const cp = profile?.user?.codigoPostal

  // Queries por categoría
  const { data: expiring } = useQuery<any>({
    queryKey: ['alerts', 'expiring'],
    queryFn: () => api.get('/items?expiringSoon=true&limit=50&sort=expiryDate&order=asc'),
    refetchInterval: 60_000,
  })
  const { data: expired } = useQuery<any>({
    queryKey: ['alerts', 'expired'],
    queryFn: () => api.get('/items?expired=true&limit=50&sort=expiryDate&order=asc'),
    refetchInterval: 60_000,
  })
  const { data: pendingDonation } = useQuery<any>({
    queryKey: ['alerts', 'pending-donation'],
    queryFn: () => api.get('/items?pendienteDonacion=true&limit=50&sort=expiryDate&order=asc'),
    refetchInterval: 60_000,
  })

  const consume = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/consume`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setActionItem(null)
      vibrate('CONFIRM')
    },
  })
  const discard = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setDonationItem(null); setActionItem(null); setSigreItem(null)
      vibrate('CONFIRM')
    },
  })
  const addToShopping = useMutation({
    mutationFn: (item: Item) => api.post('/shopping', { name: item.name, quantity: 1, unit: item.unit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shopping'] }); vibrate('ITEM_ADDED') },
  })

  const confirmDonation = useMutation({
    mutationFn: (id: string) => api.patch(`/items/${id}/discard`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      vibrate('CONFIRM')
    },
  })

  const expiringItems: Item[] = Array.isArray(expiring) ? expiring : (expiring?.data ?? [])
  const expiredItems: Item[] = Array.isArray(expired) ? expired : (expired?.data ?? [])
  const pendingDonationItems: Item[] = Array.isArray(pendingDonation) ? pendingDonation : (pendingDonation?.data ?? [])
  const allAlerts = [...expiredItems, ...expiringItems]
  const total = allAlerts.length
  const totalUnits = allAlerts.reduce((sum, i) => sum + (i.quantity || 0), 0)

  const banco = getBancoAlimentos(cp)
  const sigre = getFarmaciaSIGRE(cp)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Alertas</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
          {total === 0
            ? 'Todo en orden — no hay alertas activas 🎉'
            : `${total} producto${total > 1 ? 's' : ''} requieren atención`}
        </p>
      </div>

      {/* 🚚 Pendiente de llevar al Banco de Alimentos */}
      {pendingDonationItems.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🚚</span>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#3B6D11' }}>
              Pendiente de llevar — {pendingDonationItems.length} producto{pendingDonationItems.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(59,109,17,0.3)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '8px 20px', background: 'rgba(59,109,17,0.08)', borderBottom: '1px solid rgba(59,109,17,0.15)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Apartados para el Banco de Alimentos · {banco.nombre}
              </span>
            </div>
            {pendingDonationItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {item.zone ? `${item.zone.icon} ${item.zone.name} · ` : ''}{item.quantity} {item.unit}
                    {item.daysUntilExpiry !== undefined && (
                      <span style={{ marginLeft: 6, color: item.daysUntilExpiry <= 0 ? '#E24B4A' : '#EF9F27' }}>
                        {item.daysUntilExpiry <= 0 ? '· Caducado' : `· ${item.daysUntilExpiry} días`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => confirmDonation.mutate(item.id)}
                  disabled={confirmDonation.isPending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid rgba(59,109,17,0.4)', background: 'rgba(59,109,17,0.1)',
                    color: '#3B6D11', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✓ Entregado
                </button>
              </div>
            ))}
            <div style={{ padding: '10px 20px', background: 'rgba(59,109,17,0.04)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                📍 {banco.direccion} · 🕐 {banco.horario} · 📞 {banco.telefono}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🏦 Banner Banco de Alimentos */}
      {total > 0 && (
        <div style={{
          marginBottom: 20, padding: '14px 18px',
          background: 'rgba(59,109,17,0.07)', border: '1px solid rgba(59,109,17,0.25)',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>🏦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11' }}>
              {total} producto{total !== 1 ? 's' : ''} · {Math.round(totalUnits)} unidades disponibles para donar
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {banco.nombre} · {banco.telefono}
            </div>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#3B6D11',
            background: 'rgba(59,109,17,0.10)', border: '1px solid rgba(59,109,17,0.2)',
            padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {banco.horario}
          </div>
        </div>
      )}

      {total === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Despensa perfecta</p>
          <p style={{ fontSize: 14, margin: 0 }}>Nada caduca en los próximos 7 días</p>
        </div>
      )}

      {/* 🥫 ALIMENTACIÓN */}
      {categorias.includes('ALIMENTACION') && (expiredItems.length > 0 || expiringItems.length > 0) && (
        <CatSection icon="🥫" title="Alimentación" color="#E24B4A">
          {expiredItems.length > 0 && (
            <SubSection title="Caducados hoy" color="#E24B4A">
              {expiredItems.map(item => (
                <AlertRow key={item.id} item={item} label="Caducado" labelColor="#E24B4A"
                  onConsume={() => consume.mutate(item.id)}
                  onDonate={() => setDonationItem(item)}
                  onDiscard={() => discard.mutate(item.id)}
                  onAddToShopping={() => addToShopping.mutate(item)}
                  showDonate
                />
              ))}
            </SubSection>
          )}
          {expiringItems.length > 0 && (
            <SubSection title="Caducan pronto" color="#EF9F27">
              {expiringItems.map(item => {
                const days = item.daysUntilExpiry
                const label = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`
                const color = days! <= 1 ? '#EF9F27' : '#1D9E75'
                return (
                  <AlertRow key={item.id} item={item} label={label} labelColor={color}
                    onConsume={() => consume.mutate(item.id)}
                    onDonate={() => setDonationItem(item)}
                    onDiscard={() => discard.mutate(item.id)}
                    onAddToShopping={() => addToShopping.mutate(item)}
                    showDonate
                  />
                )
              })}
            </SubSection>
          )}
        </CatSection>
      )}

      {/* 🍷 BODEGA */}
      {categorias.includes('BODEGA') && (
        <CatSection icon="🍷" title="Bodega" color="#7F77DD">
          <div style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
            Módulo bodega activo. Las alertas de botellas abiertas y ventana óptima aparecerán aquí cuando añadas vinos a tu bodega.
          </div>
        </CatSection>
      )}

      {/* 🧴 COSMÉTICOS */}
      {categorias.includes('COSMETICOS') && (
        <CatSection icon="🧴" title="Cosméticos y belleza" color="#F09595">
          <div style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
            Módulo cosméticos activo. Las alertas de PAO (Period After Opening) aparecerán aquí cuando añadas tus productos de belleza.
          </div>
        </CatSection>
      )}

      {/* 💊 MEDICAMENTOS */}
      {categorias.includes('MEDICAMENTOS') && (
        <CatSection icon="💊" title="Medicamentos" color="#EF9F27">
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 14 }}>
              Módulo medicamentos activo. Las alertas de tomas y stock aparecerán aquí.
            </div>
            {/* Recordatorio SIGRE permanente */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
              background: 'rgba(239,159,39,0.08)', border: '1px solid rgba(239,159,39,0.25)', borderRadius: 10,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>♻️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#EF9F27', marginBottom: 2 }}>
                  Recuerda: medicamentos caducados → contenedor SIGRE
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  No los tires a la basura. Lleva los medicamentos caducados o sobrantes a cualquier farmacia con contenedor naranja SIGRE.
                </div>
                <a href={sigre.web} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: '#EF9F27', fontWeight: 600, textDecoration: 'none',
                }}>
                  <MapPin size={12} /> Encontrar farmacia SIGRE cercana
                </a>
              </div>
            </div>
          </div>
        </CatSection>
      )}

      {/* 🧹 LIMPIEZA */}
      {categorias.includes('LIMPIEZA') && (
        <CatSection icon="🧹" title="Productos de limpieza" color="#888">
          <div style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
            Módulo limpieza activo. Las alertas de caducidad y seguridad (especialmente si hay bebés en casa) aparecerán aquí.
          </div>
        </CatSection>
      )}

      {/* 👶 BEBÉS */}
      {categorias.includes('BEBES') && (
        <CatSection icon="👶" title="Bebés y lactantes" color="#7F77DD">
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 14 }}>
              Módulo bebés activo. Las alertas de tomas, introducción de sólidos y alertas AESAN aparecerán aquí con máxima prioridad.
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
              background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.25)', borderRadius: 10,
            }}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E24B4A', marginBottom: 2 }}>
                  Alertas AESAN para productos infantiles
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Si la AESAN o AEMPS retiran un producto de alimentación infantil o medicamento pediátrico, recibirás una notificación inmediata, sin filtro de horario.
                </div>
              </div>
            </div>
          </div>
        </CatSection>
      )}

      {/* 🏦 Modal donación */}
      {donationItem && (
        <Modal onClose={() => setDonationItem(null)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#3B6D11', marginBottom: 4 }}>
              🏦 Donar al Banco de Alimentos
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>{donationItem.name}</div>
            {cp
              ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Punto de recogida más cercano a {cp}:</div>
              : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Añade tu código postal en Ajustes para ver el más cercano a ti.</div>
            }
          </div>

          <div style={{ background: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{banco.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>📍 {banco.direccion}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>🕐 {banco.horario}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>📞 {banco.telefono}</div>
            <a href={`https://www.fesbal.org/bancos-de-alimentos/`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={12} /> Ver todos los Bancos de Alimentos de España
            </a>
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px', fontStyle: 'italic' }}>
            Cuando lo lleves, márcalo como donado para registrar tu impacto.
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDonationItem(null)} style={btnSec}>Volver</button>
            <button onClick={async () => {
              try {
                await api.patch(`/items/${donationItem.id}/donate`, {})
                qc.invalidateQueries({ queryKey: ['alerts'] })
                qc.invalidateQueries({ queryKey: ['pending-donation'] })
                qc.invalidateQueries({ queryKey: ['summary'] })
                vibrate('CONFIRM')
                setDonationItem(null)
              } catch (e) {
                console.error('Error donando:', e)
              }
            }} style={btnPri}>
              ✓ Apartar para donar
            </button>
          </div>
        </Modal>
      )}

      {/* ⚙️ Modal gestionar (consumir / donar / descartar) */}
      {actionItem && (
        <Modal onClose={() => setActionItem(null)}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>¿Qué hacemos con</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{actionItem.name}</div>
          </div>
          <OptionBtn icon="✅" color="#1D9E75" title="Consumirlo hoy" desc="Cero desperdicio"
            onClick={() => consume.mutate(actionItem.id)} loading={consume.isPending} />
          <OptionBtn icon="🏦" color="#3B6D11" title="Donarlo al Banco de Alimentos" desc="Llevarlo a un punto de recogida"
            onClick={() => { setActionItem(null); setDonationItem(actionItem) }} />
          <OptionBtn icon="🗑️" color="#A32D2D" title="Descartarlo" desc="No se puede consumir ni donar"
            onClick={() => discard.mutate(actionItem.id)} loading={discard.isPending} />
        </Modal>
      )}
    </div>
  )
}

// ── Componentes ───────────────────────────────────────────────────────

function CatSection({ icon, title, color, children }: { icon: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color }}>{title}</h2>
      </div>
      <div style={{ background: 'var(--surface)', border: `1px solid ${color}30`, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function SubSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ padding: '8px 20px', background: `${color}10`, borderBottom: `1px solid ${color}20` }}>
        <span style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function AlertRow({ item, label, labelColor, onConsume, onDonate, onDiscard, onAddToShopping, showDonate }: {
  item: Item; label: string; labelColor: string
  onConsume: () => void; onDonate: () => void; onDiscard: () => void; onAddToShopping: () => void
  showDonate?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {item.zone ? `${item.zone.icon} ${item.zone.name} · ` : ''}{item.quantity} {item.unit}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, background: `${labelColor}18`, borderRadius: 20, padding: '3px 10px' }}>
          {label}
        </span>
        <ActionBtn onClick={onConsume} icon={<CheckCircle size={13} />} label="Consumir" color="#1D9E75" />
        {showDonate && <ActionBtn onClick={onDonate} icon={<Heart size={13} />} label="Donar" color="#3B6D11" />}
        <ActionBtn onClick={onAddToShopping} icon={<ShoppingCart size={13} />} label="Reponer" color="#7F77DD" />
        <ActionBtn onClick={onDiscard} icon={<Trash2 size={13} />} label="Tirar" color="#A32D2D" />
      </div>
    </div>
  )
}

function ActionBtn({ onClick, icon, label, color }: { onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
      borderRadius: 8, border: `1px solid ${color}40`, background: `${color}10`,
      color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>
      {icon} {label}
    </button>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1A1A2E', border: '1px solid #2A2A3E', borderRadius: 16, padding: 24, width: 400, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function OptionBtn({ icon, color, title, desc, onClick, loading }: { icon: string; color: string; title: string; desc: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 14px', marginBottom: 8, borderRadius: 10, cursor: 'pointer',
      background: `${color}10`, border: `1px solid ${color}30`, textAlign: 'left',
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{loading ? 'Procesando...' : title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{desc}</div>
      </div>
    </button>
  )
}

const btnPri: React.CSSProperties = { flex: 2, padding: '10px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSec: React.CSSProperties = { flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }
