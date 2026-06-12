import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'

interface InviteInfo {
  householdId: string
  householdName: string
  email: string
  role: string
  expiresAt: string
}

type Status = 'loading' | 'valid' | 'accepting' | 'accepted' | 'error'

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const user = useAuth(s => s.user)
  const updateUser = useAuth(s => s.updateUser)

  const [status, setStatus] = useState<Status>('loading')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('Enlace inválido'); return }
    api.get<InviteInfo>(`/invite/${token}`)
      .then(data => { setInvite(data); setStatus('valid') })
      .catch(err => { setStatus('error'); setErrorMsg(err.message) })
  }, [token])

  // Si no está logueado, redirigir a registro con el token como param
  useEffect(() => {
    if (status === 'valid' && !user) {
      navigate(`/registro?invite=${token}`, { replace: true })
    }
  }, [status, user, token, navigate])

  async function handleAccept() {
    if (!token) return
    setStatus('accepting')
    try {
      const result = await api.post<{ householdId: string; householdName: string; alreadyMember: boolean }>(
        `/invite/${token}/accept`, {}
      )
      updateUser({ activeHouseholdId: result.householdId })
      setStatus('accepted')
      setTimeout(() => navigate('/', { replace: true }), 2000)
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  const card: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)', padding: 24,
  }
  const box: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '40px 36px', maxWidth: 440, width: '100%',
    textAlign: 'center',
  }

  if (status === 'loading') return (
    <div style={card}>
      <div style={box}>
        <h1 className="sr-only">Comprobando invitación</h1>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <p style={{ color: 'var(--muted)' }}>Comprobando invitación…</p>
      </div>
    </div>
  )

  if (status === 'error') return (
    <div style={card}>
      <div style={box}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
        <h1 style={{ fontSize: '1.17em', color: 'var(--text)', marginBottom: 8 }}>Invitación no válida</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>{errorMsg}</p>
        <button
          onClick={() => navigate('/login')}
          style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Ir al inicio
        </button>
      </div>
    </div>
  )

  if (status === 'accepted') return (
    <div style={card}>
      <div style={box}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏠</div>
        <h1 style={{ fontSize: '1.17em', color: 'var(--text)', marginBottom: 8 }}>¡Bienvenido!</h1>
        <p style={{ color: 'var(--muted)' }}>Te has unido a <strong>{invite?.householdName}</strong>. Redirigiendo…</p>
      </div>
    </div>
  )

  if (!invite || !user) return null

  // Email mismatch warning
  const emailMismatch = user.email.toLowerCase() !== invite.email.toLowerCase()

  return (
    <div style={card}>
      <div style={box}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏠</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
          Invitación al hogar
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 15 }}>
          Te han invitado a unirte a
        </p>

        <div style={{
          background: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.3)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>{invite.householdName}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Como: <strong style={{ color: 'var(--text)' }}>{invite.role === 'OWNER' ? 'Propietario' : invite.role === 'ADMIN' ? 'Administrador' : 'Miembro'}</strong>
          </div>
        </div>

        {emailMismatch && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'var(--danger)',
          }}>
            ⚠️ Esta invitación es para <strong>{invite.email}</strong>, pero estás usando <strong>{user.email}</strong>.
            <br />Para aceptarla, cierra sesión e inicia con la cuenta correcta.
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
          Sesión activa como <strong style={{ color: 'var(--text)' }}>{user.name}</strong> ({user.email})
        </div>

        <button
          onClick={handleAccept}
          disabled={emailMismatch || status === 'accepting'}
          style={{
            width: '100%', background: emailMismatch ? 'var(--border)' : 'var(--teal)',
            color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0',
            fontSize: 15, fontWeight: 700, cursor: emailMismatch ? 'not-allowed' : 'pointer',
            opacity: status === 'accepting' ? 0.7 : 1,
          }}
        >
          {status === 'accepting' ? 'Aceptando…' : 'Aceptar invitación'}
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%', background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: 13, cursor: 'pointer', marginTop: 12, padding: '8px 0',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
