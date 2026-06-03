import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuth(s => s.login)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 40, width: 380,
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'var(--teal)' }}>Stoqly</h1>
        <p style={{ margin: '0 0 32px', color: 'var(--muted)', fontSize: 14 }}>Tu despensa inteligente</p>

        <form onSubmit={submit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required autoFocus style={inputStyle}
            placeholder="tu@email.com"
          />
          <label style={labelStyle}>Contraseña</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required style={inputStyle}
            placeholder="••••••••"
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px', background: loading ? 'var(--border)' : 'var(--teal)',
            color: '#0F0F1A', border: 'none', borderRadius: 10, fontSize: 15,
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6, fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, marginBottom: 16, outline: 'none',
  boxSizing: 'border-box',
}
