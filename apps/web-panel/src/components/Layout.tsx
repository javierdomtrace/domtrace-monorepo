import React, { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Bell, Package, LogOut,
  Settings, ChefHat, PackagePlus, Zap, Home, ChevronDown, Plus, Check, Sparkles, Pill, Stethoscope, Baby,
  Menu, X,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { StoqlyWidget } from './StoqlyWidget'

interface Household {
  id: string
  name: string
  type: string
  role: string
  isActive: boolean
  itemCount: number
}

const nav = [
  { to: '/',           icon: LayoutDashboard, label: 'Inicio' },
  { to: '/pantry',     icon: Package,         label: 'Despensa' },
  { to: '/recibir',    icon: PackagePlus,     label: 'Recibir compra', highlight: true },
  { to: '/alerts',     icon: Bell,            label: 'Alertas' },
  { to: '/shopping',   icon: ShoppingCart,    label: 'Compra' },
  { to: '/dinner',     icon: ChefHat,         label: '¿Qué cocino?' },
  { to: '/cosmetics',  icon: Sparkles,        label: 'Belleza' },
  { to: '/supplements',icon: Pill,            label: 'Suplementos' },
  { to: '/medications',icon: Stethoscope,     label: 'Medicamentos' },
  { to: '/baby',       icon: Baby,            label: 'Bebés' },
  { to: '/settings',   icon: Settings,        label: 'Ajustes' },
]

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  FREE:       { label: 'Hogar',     color: '#4ECDC4' },
  EXPERTO:    { label: 'Experto',   color: '#F59E0B' },
  PREMIUM:    { label: 'Premium',   color: '#8B5CF6' },
  ENTERPRISE: { label: 'Enterprise',color: '#EF4444' },
  HOGAR:      { label: 'Hogar',     color: '#4ECDC4' },
}

export function Layout() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [householdsOpen, setHouseholdsOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Cerrar el menú móvil al cambiar de sección
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const tier = user?.subscriptionTier ?? 'FREE'
  const tierInfo = TIER_LABELS[tier] ?? TIER_LABELS.FREE

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => api.get<{ expiringSoon: number; expired: number }>('/pantry/summary'),
    refetchInterval: 60_000,
  })

  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.get<Household[]>('/households'),
    enabled: !!user,
  })

  const activeHousehold = households?.find(h => h.isActive) ?? households?.[0]
  const urgentCount = (summary?.expiringSoon ?? 0) + (summary?.expired ?? 0) + (summary?.pendienteDonacion ?? 0)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setHouseholdsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard: Escape closes dropdown, returns focus to trigger
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && householdsOpen) {
        setHouseholdsOpen(false)
        triggerRef.current?.focus()
      }
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [householdsOpen, mobileMenuOpen])

  async function switchHousehold(householdId: string) {
    if (switching) return
    setSwitching(householdId)
    try {
      await api.patch('/households/active', { householdId })
      updateUser({ activeHouseholdId: householdId })
      qc.clear()
      setHouseholdsOpen(false)
      triggerRef.current?.focus()
    } catch (e) {
      console.error('Error al cambiar hogar:', e)
    } finally {
      setSwitching(null)
    }
  }

  return (
    <div className="app-shell">
      {/* ── Barra superior móvil ── */}
      <div className="mobile-topbar">
        <button
          onClick={() => setMobileMenuOpen(o => !o)}
          aria-label={mobileMenuOpen ? 'Cerrar panel de navegación' : 'Abrir panel de navegación'}
          aria-expanded={mobileMenuOpen}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', color: 'var(--text)',
            cursor: 'pointer', padding: 4,
          }}
        >
          <Menu size={24} aria-hidden="true" />
        </button>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal)' }}>Stoqly</span>
      </div>

      {/* ── Fondo oscuro al abrir el menú móvil ── */}
      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? 'is-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside
        aria-label="Navegación principal"
        className={`app-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}
        style={{
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', padding: '24px 0',
        }}
      >
        {/* Logo + cerrar (móvil) */}
        <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span aria-hidden="true" style={{ fontSize: 24, fontWeight: 800, color: 'var(--teal)' }}>Stoqly</span>
          <button
            className="mobile-only"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar panel de navegación"
            style={{
              alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--muted)',
              cursor: 'pointer', padding: 4,
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Household switcher */}
        {households && households.length > 0 && (
          <div style={{ padding: '0 16px 16px', position: 'relative' }} ref={dropdownRef}>
            <button
              ref={triggerRef}
              onClick={() => setHouseholdsOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={householdsOpen}
              aria-label={`Hogar activo: ${activeHousehold?.name ?? 'Mi hogar'}. Haz clic para cambiar`}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                color: 'var(--text)', fontSize: 13, fontWeight: 600,
              }}
            >
              <Home size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeHousehold?.name ?? 'Mi hogar'}
              </span>
              <ChevronDown
                size={14}
                aria-hidden="true"
                style={{
                  color: 'var(--muted)', flexShrink: 0, transition: 'transform 0.15s',
                  transform: householdsOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {householdsOpen && (
              <ul
                role="listbox"
                aria-label="Seleccionar hogar"
                style={{
                  position: 'absolute', zIndex: 100, left: 16, right: 16, top: '100%',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.3)',
                  overflow: 'hidden', marginTop: 4, listStyle: 'none',
                  padding: 0, margin: '4px 0 0',
                }}
              >
                {households.map(h => (
                  <li key={h.id} role="option" aria-selected={h.isActive}>
                    <button
                      onClick={() => switchHousehold(h.id)}
                      disabled={h.isActive || switching === h.id}
                      aria-label={`${h.name}${h.isActive ? ' (activo)' : ''} — ${h.itemCount} productos`}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px',
                        background: h.isActive ? 'rgba(78,205,196,0.08)' : 'none',
                        border: 'none', borderBottom: '1px solid var(--border)',
                        cursor: h.isActive ? 'default' : 'pointer',
                        color: 'var(--text)', fontSize: 13, textAlign: 'left',
                      }}
                    >
                      <Home size={13} aria-hidden="true" style={{ color: h.isActive ? 'var(--teal)' : 'var(--muted)', flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.name}
                      </span>
                      <span aria-hidden="true" style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{h.itemCount}</span>
                      {h.isActive && <Check size={12} aria-hidden="true" style={{ color: 'var(--teal)', flexShrink: 0 }} />}
                      {switching === h.id && <span aria-live="polite" style={{ fontSize: 11, color: 'var(--muted)' }}>Cambiando…</span>}
                    </button>
                  </li>
                ))}

                {tier !== 'FREE' && (
                  <li role="option" aria-selected={false}>
                    <button
                      onClick={() => { setHouseholdsOpen(false); navigate('/settings') }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--teal)', fontSize: 13,
                      }}
                    >
                      <Plus size={13} aria-hidden="true" />
                      Añadir domicilio
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {/* Nav links */}
        <nav aria-label="Secciones de la aplicación" style={{ flex: 1 }}>
          {nav.map(({ to, icon: Icon, label, highlight }: any) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label === 'Alertas' && urgentCount > 0
                ? `${label} — ${urgentCount} alertas urgentes`
                : label
              }
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: highlight ? '9px 24px' : '10px 24px',
                color: isActive ? 'var(--teal)' : highlight ? '#3B6D11' : 'var(--muted)',
                background: isActive
                  ? 'rgba(78,205,196,0.08)'
                  : highlight ? 'rgba(59,109,17,0.07)' : 'transparent',
                borderLeft: isActive
                  ? '3px solid var(--teal)'
                  : highlight ? '3px solid #3B6D11' : '3px solid transparent',
                textDecoration: 'none', fontSize: 14, fontWeight: highlight ? 700 : 500,
                transition: 'all 0.15s',
              })}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
              {label === 'Alertas' && urgentCount > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    marginLeft: 'auto', background: 'var(--danger)', color: '#fff',
                    borderRadius: 10, fontSize: 11, fontWeight: 700,
                    padding: '1px 7px', minWidth: 20, textAlign: 'center',
                  }}
                >
                  {urgentCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Plan badge */}
        <NavLink
          to="/plans"
          aria-label={`Plan ${tierInfo.label}${tier === 'FREE' ? ' — mejorar plan' : ''}`}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            margin: '0 12px 8px', padding: '10px 14px', borderRadius: 10,
            background: isActive ? 'rgba(78,205,196,0.08)' : 'rgba(78,205,196,0.04)',
            border: `1px solid ${isActive ? 'var(--teal)' : 'transparent'}`,
            textDecoration: 'none', transition: 'all 0.15s',
          })}
        >
          <Zap size={15} aria-hidden="true" style={{ color: tierInfo.color, flexShrink: 0 }} />
          <div aria-hidden="true">
            <div style={{ fontSize: 12, color: tierInfo.color, fontWeight: 700 }}>
              Plan {tierInfo.label}
            </div>
            {tier === 'FREE' && (
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Mejorar plan →</div>
            )}
          </div>
        </NavLink>

        {/* User footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)' }}>
          <div
            aria-label={`Usuario: ${user?.name}, ${user?.email}`}
            style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}
          >
            {user?.name}
          </div>
          <div aria-hidden="true" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{user?.email}</div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            aria-label="Cerrar sesión"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', color: 'var(--muted)',
              fontSize: 13, cursor: 'pointer', padding: 0,
            }}
          >
            <LogOut size={14} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        id="main-content"
        tabIndex={-1}
        key={user?.activeHouseholdId ?? 'default'}
        aria-label="Contenido principal"
        className="app-main"
        style={{ flex: 1, overflowY: 'auto', padding: 32 }}
      >
        <Outlet />
      </main>

      {/* Stoqly Widget */}
      <StoqlyWidget />
    </div>
  )
}
