import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) setError('Enlace inválido o caducado.')
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)

      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      setError(err.message ?? 'Error al restablecer la contraseña')
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
        <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          Nueva contraseña
        </p>
        <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 14 }}>
          Elige una contraseña nueva para tu cuenta.
        </p>

        {done ? (
          <div style={{
            background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)',
            borderRadius: 10, padding: '16px 20px',
          }}>
            <p style={{ margin: 0, color: 'var(--teal)', fontSize: 14, fontWeight: 600 }}>
              ✓ Contraseña actualizada
            </p>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Ya puedes entrar con tu nueva contraseña. Redirigiendo...
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={labelStyle}>Nueva contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoFocus style={inputStyle}
              placeholder="Mínimo 8 caracteres"
              disabled={!token}
            />
            <label style={labelStyle}>Confirmar contraseña</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              required style={inputStyle}
              placeholder="Repite la contraseña"
              disabled={!token}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
            <button type="submit" disabled={loading || !token} style={{
              width: '100%', padding: '14px',
              background: (loading || !token) ? 'var(--border)' : 'var(--teal)',
              color: '#0F0F1A', border: 'none', borderRadius: 10, fontSize: 15,
              fontWeight: 700, cursor: (loading || !token) ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
          <Link to="/login" style={{ color: 'var(--teal)', fontWeight: 600 }}>← Volver al inicio de sesión</Link>
        </p>
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
