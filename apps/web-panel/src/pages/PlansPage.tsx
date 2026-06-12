import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, type Tier } from '../store/auth'
import { api } from '../lib/api'
import { Check, Crown, Home, Star, Zap, ExternalLink, ArrowRight } from 'lucide-react'

interface Plan {
  tier: Tier
  name: string
  price: string
  period: string
  description: string
  icon: React.ReactNode
  color: string
  households: string
  members: string
  features: string[]
  cta: string
  popular?: boolean
}

const PLANS: Plan[] = [
  {
    tier: 'FREE',
    name: 'Plan Hogar',
    price: 'Gratis',
    period: 'siempre',
    description: 'Para familias que quieren organizar su despensa',
    icon: <Home size={22} />,
    color: '#4ECDC4',
    households: '1 domicilio',
    members: 'Hasta 5 personas',
    features: [
      'Despensa ilimitada',
      'Alertas de caducidad',
      'Lista de la compra inteligente',
      'Asistente Stoqly',
      'Escaneo de productos EAN',
      'Donación a Banco de Alimentos',
      'Reciclaje SIGRE',
    ],
    cta: 'Tu plan actual',
  },
  {
    tier: 'EXPERTO',
    name: 'Plan Experto',
    price: '9,99€',
    period: 'año',
    description: 'Para quienes tienen más de un domicilio',
    icon: <Star size={22} />,
    color: '#F59E0B',
    households: 'Hasta 3 domicilios',
    members: 'Hasta 10 personas',
    features: [
      'Todo lo del Plan Hogar',
      'Hasta 3 domicilios (casa + segunda vivienda)',
      'Selector de domicilio activo',
      'Historial de consumo detallado',
      'Planificador de menús avanzado',
      'Módulo cosméticos (PAO)',
      'Módulo medicamentos',
      'Soporte prioritario',
    ],
    cta: 'Elegir Experto',
    popular: true,
  },
  {
    tier: 'PREMIUM',
    name: 'Plan Premium',
    price: '19,99€',
    period: 'año',
    description: 'Acceso total a todas las funcionalidades',
    icon: <Crown size={22} />,
    color: '#8B5CF6',
    households: 'Hasta 5 domicilios',
    members: 'Ilimitados',
    features: [
      'Todo lo del Plan Experto',
      'Hasta 5 domicilios',
      'Estadísticas y métricas de ahorro',
      'Exportación de datos',
      'Módulo bebés y lactantes',
      'Alertas sanitarias (AESAN + RASFF)',
      'IA avanzada con contexto extendido',
      'Scan & Go en supermercado',
    ],
    cta: 'Elegir Premium',
  },
]

export function PlansPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const currentTier = user?.subscriptionTier ?? 'FREE'

  useEffect(() => {
    if (searchParams.get('success')) {
      const tier = searchParams.get('tier') as Tier
      if (tier) updateUser({ subscriptionTier: tier })
      setToast({ type: 'ok', msg: `✅ ¡Bienvenido al Plan ${tier === 'EXPERTO' ? 'Experto' : 'Premium'}! Ya tienes acceso a todas las funciones.` })
      window.history.replaceState({}, '', '/plans')
    }
    if (searchParams.get('cancelled')) {
      setToast({ type: 'err', msg: 'Pago cancelado. Puedes intentarlo cuando quieras.' })
      window.history.replaceState({}, '', '/plans')
    }
  }, [searchParams, updateUser])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleUpgrade(tier: Tier) {
    if (tier === 'FREE' || tier === currentTier) return
    setLoading(tier)
    try {
      const res = await api.post<{ url: string }>('/billing/checkout', { tier })
      window.location.href = res.url
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message ?? 'Error al conectar con Stripe' })
      setLoading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await api.get<{ url: string }>('/billing/portal')
      window.location.href = res.url
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message ?? 'Error al abrir el portal de facturación' })
      setPortalLoading(false)
    }
  }

  const tierOrder: Tier[] = ['FREE', 'EXPERTO', 'PREMIUM']
  const currentIdx = tierOrder.indexOf(currentTier as any) === -1 ? 0 : tierOrder.indexOf(currentTier as any)

  const currentPlan = PLANS.find(p => p.tier === currentTier) ?? PLANS[0]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 999,
          background: toast.type === 'ok' ? '#064e3b' : '#7f1d1d',
          color: '#fff', borderRadius: 12, padding: '14px 22px',
          boxShadow: '0 8px 32px rgba(0,0,0,.4)', fontSize: 14, fontWeight: 600,
          maxWidth: 420,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          <Zap size={28} style={{ verticalAlign: 'middle', color: 'var(--teal)', marginRight: 10 }} />
          Planes Stoqly
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 24 }}>
          Empieza gratis. Mejora cuando lo necesites.
        </p>

        {/* Plan actual */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 18px',
        }}>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Plan actual:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: currentPlan.color }}>
            {currentPlan.name}
          </span>
          {currentTier !== 'FREE' && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              style={{
                marginLeft: 4, fontSize: 12, color: 'var(--teal)',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: portalLoading ? 0.6 : 1,
              }}
            >
              <ExternalLink size={12} />
              {portalLoading ? 'Abriendo…' : 'Gestionar suscripción'}
            </button>
          )}
        </div>
      </div>

      {/* Plans grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        marginBottom: 48,
      }}>
        {PLANS.map((plan, i) => {
          const isCurrent = plan.tier === currentTier
          const planIdx = tierOrder.indexOf(plan.tier as any)
          const isDowngrade = planIdx < currentIdx
          const isUpgrade = planIdx > currentIdx

          return (
            <div
              key={plan.tier}
              style={{
                background: 'var(--surface)',
                border: `2px solid ${isCurrent ? plan.color : plan.popular && !isCurrent ? plan.color + '40' : 'var(--border)'}`,
                borderRadius: 18,
                padding: 28,
                position: 'relative',
              }}
            >
              {plan.popular && !isCurrent && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: plan.color, color: '#fff',
                  borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}>
                  MÁS POPULAR
                </div>
              )}
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: plan.color, color: '#fff',
                  borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}>
                  TU PLAN ACTUAL
                </div>
              )}

              {/* Icon + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: plan.color + '20', color: plan.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {plan.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>{plan.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{plan.description}</div>
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: plan.color }}>{plan.price}</span>
                {plan.tier !== 'FREE' && (
                  <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 5 }}>/{plan.period}</span>
                )}
              </div>

              {/* Highlights */}
              <div style={{
                background: plan.color + '12', borderRadius: 8,
                padding: '8px 12px', marginBottom: 18, fontSize: 12,
              }}>
                <div style={{ color: plan.color, fontWeight: 700 }}>{plan.households}</div>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>{plan.members}</div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                    <Check size={13} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => isUpgrade ? handleUpgrade(plan.tier) : undefined}
                disabled={isCurrent || isDowngrade || loading === plan.tier}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10,
                  fontWeight: 700, fontSize: 14,
                  cursor: (isCurrent || isDowngrade) ? 'default' : 'pointer',
                  border: isCurrent ? `2px solid ${plan.color}` : 'none',
                  background: isCurrent ? 'transparent' : isDowngrade ? 'var(--border)' : plan.color,
                  color: isCurrent ? plan.color : isDowngrade ? 'var(--muted)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: loading === plan.tier ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {loading === plan.tier
                  ? 'Redirigiendo a Stripe…'
                  : isCurrent
                    ? plan.cta
                    : isDowngrade
                      ? 'Plan inferior'
                      : <>{plan.cta} <ArrowRight size={14} /></>
                }
              </button>
            </div>
          )
        })}
      </div>

      {/* Enterprise teaser */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            🏢 Stoqly Enterprise — Próximamente
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 580 }}>
            Para hostelería, restaurantes, hoteles y empresas. Gestión de inventario sin límites, no solo alimentación. Si te interesa ser de los primeros, escríbenos.
          </div>
        </div>
        <a
          href="mailto:hola@stoqly.app?subject=Stoqly Enterprise"
          style={{
            flexShrink: 0, padding: '10px 20px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'none',
            color: 'var(--text)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          Me interesa →
        </a>
      </div>

      {/* FAQ */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 32,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Preguntas frecuentes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {[
            ['¿El plan Hogar es gratis para siempre?', 'Sí. El Plan Hogar no tiene coste y nunca lo tendrá. Creemos que todos merecen controlar su despensa sin pagar.'],
            ['¿Puedo cambiar de plan en cualquier momento?', 'Sí. Puedes mejorar en cualquier momento. Si bajas de plan, el cambio se aplica al final del período actual.'],
            ['¿Cómo funciona el selector de domicilios?', 'Crea un segundo hogar desde Ajustes → Mis domicilios y cambia entre ellos desde el menú lateral. Cada uno tiene su propia despensa.'],
            ['¿Aceptáis tarjetas y domiciliación bancaria?', 'Sí. Los pagos van a través de Stripe. Aceptamos Visa, Mastercard, débito y SEPA.'],
          ].map(([q, a]) => (
            <div key={q}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, marginBottom: 6 }}>{q}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
