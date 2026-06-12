import React, { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import { useAuth } from '../store/auth'

type Step = 'account' | 'name' | 'household' | 'supermarket' | 'location' | 'done'

const SUPERMARKETS = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'El Corte Inglés', 'Alcampo', 'Dia', 'Consum', 'Eroski']

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const { login } = useAuth()

  const [step, setStep] = useState<Step>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Datos del formulario
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [supermarket, setSupermarket] = useState('')
  const [codigoPostal, setCodigoPostal] = useState('')
  const [userId, setUserId] = useState('')

  const next = (s: Step) => { setError(''); setStep(s) }

  // Paso 1: crear cuenta
  const createAccount = async () => {
    if (!email || !password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<any>('/auth/register', { email, password, name: name || email.split('@')[0] })
      setToken(res.tokens.accessToken)
      setUserId(res.user.id)
      next('name')
    } catch (e: any) {
      if (e.message?.includes('ya registrado') || e.message?.includes('EMAIL_EXISTS')) {
        setError('__EMAIL_EXISTS__')
      } else {
        setError(e.message)
      }
    } finally { setLoading(false) }
  }

  // Pasos de configuración (llaman a la API)
  const saveAndNext = async (nextStep: Step, body?: object) => {
    if (body) {
      setLoading(true)
      try {
        await api.put('/profile', body)
      } catch (e: any) { setError(e.message); setLoading(false); return }
      setLoading(false)
    }
    next(nextStep)
  }

  const finish = async () => {
    setLoading(true)
    try {
      if (supermarket) await api.put('/profile/household', { supermarket })
      if (codigoPostal) await api.put('/profile', { codigoPostal })
      await login(email, password)
      navigate(inviteToken ? `/invite/${inviteToken}` : '/', { replace: true })
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 36, width: 400, maxWidth: '100%',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#1D9E75' }}>Stoqly</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Tu despensa inteligente</div>
        </div>

        {/* Paso 1: Cuenta */}
        {step === 'account' && (
          <div>
            <p style={{ fontSize: 15, color: 'var(--text)', margin: '0 0 20px', textAlign: 'center' }}>
              Crea tu cuenta gratuita
            </p>
            <label style={lbl}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoFocus placeholder="tu@email.com" style={inp}
              onKeyDown={e => e.key === 'Enter' && createAccount()} />
            <label style={lbl}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres" style={inp}
              onKeyDown={e => e.key === 'Enter' && createAccount()} />
            {error === '__EMAIL_EXISTS__' ? (
              <div style={{ background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                <p style={{ ...errStyle, margin: 0 }}>Este email ya tiene cuenta.</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                  ¿Has borrado la caché? <Link to="/login" style={{ color: '#1D9E75', fontWeight: 600 }}>Entra aquí con tu contraseña →</Link>
                </p>
              </div>
            ) : error ? <p style={errStyle}>{error}</p> : null}
            <button onClick={createAccount} disabled={!email || !password || loading}
              style={{ ...btnPri, opacity: !email || !password || loading ? 0.5 : 1 }}>
              {loading ? 'Creando cuenta...' : 'Empezar →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 16 }}>
              ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#1D9E75' }}>Entrar</Link>
            </p>
          </div>
        )}

        {/* Paso 2: Nombre */}
        {step === 'name' && (
          <div>
            <StoqlyMsg>Hola, soy Stoqly. Voy a ayudarte a que nunca te falte nada en casa. ¿Cómo te llamo?</StoqlyMsg>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Tu nombre" style={inp}
              onKeyDown={e => e.key === 'Enter' && name && saveAndNext('supermarket', { name })} />
            {error && <p style={errStyle}>{error}</p>}
            <button onClick={() => name && saveAndNext('supermarket', { name })}
              disabled={!name || loading} style={{ ...btnPri, opacity: !name || loading ? 0.5 : 1 }}>
              {loading ? 'Guardando...' : 'Siguiente →'}
            </button>
          </div>
        )}

        {/* Paso 3: Supermercado */}
        {step === 'supermarket' && (
          <div>
            <StoqlyMsg>¡Hola, {name}! ¿Dónde sueles hacer la compra?</StoqlyMsg>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {SUPERMARKETS.map(s => (
                <button key={s} onClick={() => setSupermarket(s)} style={{
                  padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                  border: supermarket === s ? '1px solid #1D9E75' : '1px solid var(--border)',
                  background: supermarket === s ? 'rgba(29,158,117,0.12)' : 'var(--bg)',
                  color: supermarket === s ? '#1D9E75' : 'var(--muted)',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => next('location')} style={{ ...btnSec, flex: 1 }}>Saltar</button>
              <button onClick={() => next('location')} disabled={!supermarket}
                style={{ ...btnPri, flex: 2, opacity: !supermarket ? 0.5 : 1 }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* Paso 4: Código postal */}
        {step === 'location' && (
          <div>
            <StoqlyMsg>¿Cuál es tu código postal? Lo uso para localizar el Banco de Alimentos y la farmacia SIGRE más cercanos cuando los necesites.</StoqlyMsg>
            <input value={codigoPostal}
              onChange={e => setCodigoPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Ej: 28001" maxLength={5} style={inp}
              onKeyDown={e => e.key === 'Enter' && next('done')} />
            {error && <p style={errStyle}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => next('done')} style={{ ...btnSec, flex: 1 }}>Saltar</button>
              <button onClick={() => next('done')} style={{ ...btnPri, flex: 2 }}>
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* Paso 5: Listo */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <StoqlyMsg>¡Perfecto, {name}! Ya sé lo suficiente para empezar. Cuando llegues a casa con algo, solo dímelo y yo me encargo.</StoqlyMsg>
            <button onClick={finish} disabled={loading}
              style={{ ...btnPri, marginTop: 8, opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Entrando...' : '¡Vamos a la despensa! →'}
            </button>
          </div>
        )}

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
          {['account', 'name', 'supermarket', 'location', 'done'].map((s, i) => (
            <div key={s} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: step === s ? '#1D9E75' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StoqlyMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#1D9E75',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0, color: '#fff',
      }}>✦</div>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: '4px 14px 14px 14px', padding: '10px 14px',
        fontSize: 14, color: 'var(--text)', lineHeight: 1.5, flex: 1,
      }}>{children}</div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none',
}
const btnPri: React.CSSProperties = { width: '100%', padding: '12px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnSec: React.CSSProperties = { padding: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }
const errStyle: React.CSSProperties = { color: '#E24B4A', fontSize: 13, margin: '-8px 0 12px' }
