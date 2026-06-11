import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message ?? 'Error al enviar el email')
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
          Recuperar contraseña
        </p>
        <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 14 }}>
          Te enviamos un enlace para restablecer tu contraseña.
        </p>

        {sent ? (
          <div style={{
            background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)',
            borderRadius: 10, padding: '16px 20px', marginBottom: 24,
          }}>
            <p style={{ margin: 0, color: 'var(--teal)', fontSize: 14, fontWeight: 600 }}>
              ✓ Email enviado
            </p>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace en los próximos minutos.
              Revisa también tu carpeta de spam.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus style={inputStyle}
              placeholder="tu@email.com"
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', background: loading ? 'var(--border)' : 'var(--teal)',
              color: '#0F0F1A', border: 'none', borderRadius: 10, fontSize: 15,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
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
