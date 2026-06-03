import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Bell, Package, LogOut } from 'lucide-react'
import { useAuth } from '../store/auth'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

const nav = [
  { to: '/',        icon: LayoutDashboard, label: 'Inicio' },
  { to: '/pantry',  icon: Package,          label: 'Despensa' },
  { to: '/alerts',  icon: Bell,             label: 'Alertas' },
  { to: '/shopping',icon: ShoppingCart,     label: 'Compra' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Badge de alertas urgentes
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => api.get<{ expiringSoon: number; expired: number }>('/pantry/summary'),
    refetchInterval: 60_000,
  })

  const urgentCount = (summary?.expiringSoon ?? 0) + (summary?.expired ?? 0)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '24px 0',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 24px 32px' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--teal)' }}>Stoqly</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px',
              color: isActive ? 'var(--teal)' : 'var(--muted)',
              background: isActive ? 'rgba(78,205,196,0.08)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--teal)' : '3px solid transparent',
              textDecoration: 'none', fontSize: 14, fontWeight: 500,
              transition: 'all 0.15s',
            })}>
              <Icon size={18} />
              {label}
              {label === 'Alertas' && urgentCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--danger)', color: '#fff',
                  borderRadius: 10, fontSize: 11, fontWeight: 700,
                  padding: '1px 7px', minWidth: 20, textAlign: 'center',
                }}>
                  {urgentCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
            {user?.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{user?.email}</div>
          <button onClick={() => { logout(); navigate('/login') }} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: 13, cursor: 'pointer', padding: 0,
          }}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <Outlet />
      </main>
    </div>
  )
}
