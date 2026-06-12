import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Save, User, Home, AlertTriangle, MapPin, Users, Trash2, UserPlus, Plus, X, Layers, Accessibility, CreditCard, Pencil, Truck, Zap, Check, Target } from 'lucide-react'
import { vibrate, VIBRATION_PATTERNS } from '../lib/vibration'
import { useAuth } from '../store/auth'

// ── Constantes ────────────────────────────────────────────────────────
const ALLERGEN_LABELS: Record<string, string> = {
  GLUTEN: 'Gluten', LACTOSA: 'Lactosa', FRUTOS_SECOS: 'Frutos secos',
  HUEVO: 'Huevo', MARISCO: 'Marisco', SOY: 'Soja',
  APIO: 'Apio', MOSTAZA: 'Mostaza', SESAMO: 'Sésamo', SULFITOS: 'Sulfitos'
}
const ACCESSIBILITY_LABELS: Record<string, string> = {
  VOICE: '🔊 Voz', VIBRATION: '📳 Vibración', SILENT: '🔔 Silencioso', COMBINED: '♿ Combinado'
}
const SUPERMARKETS = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'El Corte Inglés', 'Alcampo', 'Dia', 'Consum', 'Eroski', 'Otro']

const CATEGORIAS = [
  { id: 'ALIMENTACION', icon: '🥫', label: 'Alimentación', desc: 'Despensa, nevera y congelador. Siempre activa.', locked: true, tier: 'Free' },
  { id: 'BODEGA', icon: '🍷', label: 'Bodega y vinos', desc: 'Control de vinos con ventana óptima de consumo y sugerencias de maridaje.', locked: false, tier: 'Free' },
  { id: 'COSMETICOS', icon: '🧴', label: 'Cosméticos y belleza', desc: 'Control de PAO (Period After Opening) para cremas, sérum y maquillaje.', locked: false, tier: 'Hogar' },
  { id: 'MEDICAMENTOS', icon: '💊', label: 'Medicamentos', desc: 'Avisos de toma, control de stock y reciclaje SIGRE en farmacia.', locked: false, tier: 'Hogar' },
  { id: 'LIMPIEZA', icon: '🧹', label: 'Productos de limpieza', desc: 'Control de caducidad y alertas de seguridad si hay bebés en casa.', locked: false, tier: 'Free' },
  { id: 'BEBES', icon: '👶', label: 'Bebés y lactantes', desc: 'Tomas, introducción de sólidos, medicamentos pediátricos y alertas de máxima prioridad.', locked: false, tier: 'Hogar' },
]

const TIER_COLORS: Record<string, [string, string]> = {
  Free: ['rgba(29,158,117,0.1)', '#1D9E75'],
  Hogar: ['rgba(239,159,39,0.1)', '#854F0B'],
  Pro: ['rgba(127,119,221,0.1)', '#3C3489'],
}

interface Zone { id: string; name: string; icon: string; temperatureType: string }
interface Member { id: string; name: string; email: string; role: string }
interface Profile {
  user: {
    id: string; name: string; email: string; assistantName: string
    allergens: string[]; alergiasPersonalizadas?: string[]
    accessibilityMode: string; humorEnabled: boolean; voiceSpeed: string
    highContrast?: boolean; textSize?: string; reduceMotion?: boolean
    codigoPostal?: string; categoriasActivas?: string[]
    pesoKg?: number; alturaCm?: number; edadAnos?: number
    nivelActividad?: string; objetivoNutricional?: string
  }
  household: { id: string; name: string; supermarket?: string; role: string; members?: Member[]; direccionCalle?: string; direccionPiso?: string; direccionCodigoPostal?: string; direccionCiudad?: string; direccionNombre?: string; direccionTelefono?: string } | null
}

interface Household { id: string; name: string; type: string; role: string; isActive: boolean; itemCount: number }

export function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const tier = user?.subscriptionTier ?? 'FREE'
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [showAddHousehold, setShowAddHousehold] = useState(false)
  const [householdMsg, setHouseholdMsg] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [newAllergen, setNewAllergen] = useState('')
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneIcon, setNewZoneIcon] = useState('📦')
  const [showAddZone, setShowAddZone] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)

  const { data, isLoading } = useQuery<Profile>({ queryKey: ['profile'], queryFn: () => api.get('/profile') })
  const { data: zonesData } = useQuery<Zone[]>({ queryKey: ['zones'], queryFn: () => api.get('/pantry/zones') })
  const { data: households, refetch: refetchHouseholds } = useQuery<Household[]>({ queryKey: ['households'], queryFn: () => api.get('/households') })

  const addHousehold = useMutation({
    mutationFn: (name: string) => api.post('/households', { name }),
    onSuccess: () => { refetchHouseholds(); setNewHouseholdName(''); setShowAddHousehold(false); setHouseholdMsg('Domicilio añadido 🏡') },
    onError: (e: any) => setHouseholdMsg(e.message ?? 'Error al crear domicilio'),
  })

  const deleteHousehold = useMutation({
    mutationFn: (id: string) => api.delete(`/households/${id}`),
    onSuccess: () => { refetchHouseholds(); qc.invalidateQueries({ queryKey: ['summary'] }) },
  })

  // Estado del formulario
  const [userName, setUserName] = useState('')
  const [assistantName, setAssistantName] = useState('')
  const [allergens, setAllergens] = useState<string[]>([])
  const [alergiasPersonalizadas, setAlergiasPersonalizadas] = useState<string[]>([])
  const [accessibilityMode, setAccessibilityMode] = useState('VOICE')
  const [humorEnabled, setHumorEnabled] = useState(true)
  const [voiceSpeed, setVoiceSpeed] = useState('NORMAL')
  const [highContrast, setHighContrast] = useState(false)
  const [textSize, setTextSize] = useState('NORMAL')
  const [reduceMotion, setReduceMotion] = useState(false)
  const [householdName, setHouseholdName] = useState('')
  const [supermarket, setSupermarket] = useState('')
  const [codigoPostal, setCodigoPostal] = useState('')
  const [categoriasActivas, setCategoriasActivas] = useState<string[]>(['ALIMENTACION'])
  const [dirCalle, setDirCalle] = useState('')
  const [dirPiso, setDirPiso] = useState('')
  const [dirCP, setDirCP] = useState('')
  const [dirCiudad, setDirCiudad] = useState('')
  const [dirNombre, setDirNombre] = useState('')
  const [dirTelefono, setDirTelefono] = useState('')
  // Perfil nutricional
  const [pesoKg, setPesoKg] = useState('')
  const [alturaCm, setAlturaCm] = useState('')
  const [edadAnos, setEdadAnos] = useState('')
  const [nivelActividad, setNivelActividad] = useState('')
  const [objetivoNutricional, setObjetivoNutricional] = useState('')
  // Actividad física
  const [deporte, setDeporte] = useState('')
  const [deporteNivel, setDeporteNivel] = useState('')
  const [deporteDiasSemana, setDeporteDiasSemana] = useState('')

  useEffect(() => {
    if (data) {
      setUserName(data.user.name)
      setAssistantName(data.user.assistantName)
      setAllergens(data.user.allergens ?? [])
      setAlergiasPersonalizadas(data.user.alergiasPersonalizadas ?? [])
      setAccessibilityMode(data.user.accessibilityMode)
      setHumorEnabled(data.user.humorEnabled)
      setVoiceSpeed(data.user.voiceSpeed)
      setHighContrast(data.user.highContrast ?? false)
      setTextSize(data.user.textSize ?? 'NORMAL')
      setReduceMotion(data.user.reduceMotion ?? false)
      setHouseholdName(data.household?.name ?? '')
      setSupermarket(data.household?.supermarket ?? '')
      setCodigoPostal(data.user.codigoPostal ?? '')
      setCategoriasActivas(data.user.categoriasActivas ?? ['ALIMENTACION'])
      setDirCalle(data.household?.direccionCalle ?? '')
      setDirPiso(data.household?.direccionPiso ?? '')
      setDirCP(data.household?.direccionCodigoPostal ?? '')
      setDirCiudad(data.household?.direccionCiudad ?? '')
      setDirNombre(data.household?.direccionNombre ?? '')
      setDirTelefono(data.household?.direccionTelefono ?? '')
      // Perfil nutricional
      setPesoKg(data.user.pesoKg ? String(data.user.pesoKg) : '')
      setAlturaCm(data.user.alturaCm ? String(data.user.alturaCm) : '')
      setEdadAnos(data.user.edadAnos ? String(data.user.edadAnos) : '')
      setNivelActividad(data.user.nivelActividad ?? '')
      setObjetivoNutricional(data.user.objetivoNutricional ?? '')
      // Actividad física
      setDeporte(data.user.deporte ?? '')
      setDeporteNivel(data.user.deporteNivel ?? '')
      setDeporteDiasSemana(data.user.deporteDiasSemana ? String(data.user.deporteDiasSemana) : '')
    }
  }, [data])

  const saveProfile = useMutation({
    mutationFn: async () => {
      await api.put('/profile', {
        name: userName, assistantName, allergens, alergiasPersonalizadas,
        accessibilityMode, humorEnabled, voiceSpeed,
        highContrast, textSize, reduceMotion,
        codigoPostal: codigoPostal || undefined,
        categoriasActivas,
        // Perfil nutricional — solo si están rellenos
        ...(pesoKg ? { pesoKg: parseFloat(pesoKg) } : {}),
        ...(alturaCm ? { alturaCm: parseFloat(alturaCm) } : {}),
        ...(edadAnos ? { edadAnos: parseInt(edadAnos) } : {}),
        ...(nivelActividad ? { nivelActividad } : {}),
        ...(objetivoNutricional ? { objetivoNutricional } : {}),
        // Actividad física
        ...(deporte !== undefined ? { deporte: deporte || null } : {}),
        ...(deporteNivel ? { deporteNivel } : {}),
        ...(deporteDiasSemana ? { deporteDiasSemana: parseInt(deporteDiasSemana) } : {}),
      })
      await api.put('/profile/household', {
        name: householdName, supermarket,
        direccionCalle: dirCalle, direccionPiso: dirPiso,
        direccionCodigoPostal: dirCP, direccionCiudad: dirCiudad,
        direccionNombre: dirNombre, direccionTelefono: dirTelefono,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (err: any) => {
      alert(`Error al guardar: ${err.message ?? 'Error desconocido'}`)
    },
  })

  const invite = useMutation({
    mutationFn: () => api.post<{ inviteUrl: string }>('/profile/household/invite', { email: inviteEmail }),
    onSuccess: () => {
      setInviteSuccess(`Invitación enviada a ${inviteEmail}`)
      setInviteEmail(''); setInviteError('')
      qc.invalidateQueries({ queryKey: ['profile'] })
      setTimeout(() => setInviteSuccess(''), 5000)
    },
    onError: (err: any) => setInviteError(err.message),
  })

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/profile/household/member/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const addZone = useMutation({
    mutationFn: () => api.post('/pantry/zones', { name: newZoneName, icon: newZoneIcon, temperatureType: 'AMBIENT', position: (zonesData?.length ?? 0) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); setShowAddZone(false); setNewZoneName(''); setNewZoneIcon('📦') },
  })

  const deleteZone = useMutation({
    mutationFn: (id: string) => api.delete(`/pantry/zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  const updateZone = useMutation({
    mutationFn: (z: Zone) => api.put(`/pantry/zones/${z.id}`, { name: z.name, icon: z.icon }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones'] }); setEditingZone(null) },
  })

  const toggleAllergen = (a: string) => setAllergens(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a])
  const toggleCategoria = (id: string) => {
    if (id === 'ALIMENTACION') return
    setCategoriasActivas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }
  const addAllergenPersonal = () => {
    const a = newAllergen.trim()
    if (a && !alergiasPersonalizadas.includes(a)) {
      setAlergiasPersonalizadas(p => [...p, a])
      setNewAllergen('')
    }
  }
  const removeAllergenPersonal = (a: string) => setAlergiasPersonalizadas(p => p.filter(x => x !== a))

  if (isLoading) return <div style={{ color: 'var(--muted)', padding: 40 }}>Cargando...</div>

  // Botón Editar / Guardar cambios (se usa arriba y abajo de la página)
  const EditSaveButton = () => (
    editing ? (
      <button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
        background: saved ? '#0F6E56' : '#1D9E75', border: 'none', borderRadius: 10,
        color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        <Save size={15} /> {saved ? '¡Guardado!' : saveProfile.isPending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    ) : (
      <button onClick={() => setEditing(true)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
        background: 'transparent', border: '1px solid #1D9E75', borderRadius: 10,
        color: '#1D9E75', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        <Pencil size={15} /> Editar
      </button>
    )
  )

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Configuración</h1>
        <EditSaveButton />
      </div>

      {/* Pulsa «Editar» para modificar los datos de esta página */}
      {!editing && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-20px 0 16px' }}>
          Pulsa «Editar» para modificar tus datos.
        </p>
      )}

      <div style={editGate(editing)}>

      {/* 1 — Mi cuenta */}
      <Section icon={<User size={16} />} title="Mi cuenta">
        <Field label="Tu nombre">
          <input value={userName} onChange={e => setUserName(e.target.value)} disabled={!editing} style={inp} />
        </Field>
        <Field label="Email">
          <input value={data?.user.email ?? ''} disabled style={{ ...inp, opacity: 0.5 }} />
        </Field>
        <Field label="Código postal">
          <input value={codigoPostal} onChange={e => setCodigoPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
            disabled={!editing} placeholder="Ej: 28001" maxLength={5} style={{ ...inp, maxWidth: 140 }} />
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-10px 0 0' }}>
            Para localizar el Banco de Alimentos y la farmacia SIGRE más cercanos.
          </p>
        </Field>
      </Section>

      {/* 2 — Perfil nutricional (opcional) */}
      <NutritionalSection
        editing={editing}
        pesoKg={pesoKg} setPesoKg={setPesoKg}
        alturaCm={alturaCm} setAlturaCm={setAlturaCm}
        edadAnos={edadAnos} setEdadAnos={setEdadAnos}
        nivelActividad={nivelActividad} setNivelActividad={setNivelActividad}
        objetivoNutricional={objetivoNutricional} setObjetivoNutricional={setObjetivoNutricional}
      />

      {/* 3 — Actividad física */}
      <SportSection
        editing={editing}
        deporte={deporte} setDeporte={setDeporte}
        deporteNivel={deporteNivel} setDeporteNivel={setDeporteNivel}
        deporteDiasSemana={deporteDiasSemana} setDeporteDiasSemana={setDeporteDiasSemana}
      />

      {/* 5 — Mi Stoqly */}
      <Section icon={<span style={{ fontSize: 16 }}>✦</span>} title="Mi Stoqly">
        <Field label="Modo de aviso">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(ACCESSIBILITY_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setAccessibilityMode(k)} style={{
                padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                border: accessibilityMode === k ? '1px solid #1D9E75' : '1px solid var(--border)',
                background: accessibilityMode === k ? 'rgba(29,158,117,0.1)' : 'var(--surface)',
                color: accessibilityMode === k ? '#1D9E75' : 'var(--muted)',
              }}>{v}</button>
            ))}
          </div>
        </Field>
        <Field label="Velocidad de voz">
          <div style={{ display: 'flex', gap: 8 }}>
            {['SLOW', 'NORMAL', 'FAST'].map((s, i) => (
              <button key={s} onClick={() => setVoiceSpeed(s)} style={{
                flex: 1, padding: '9px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                border: voiceSpeed === s ? '1px solid #1D9E75' : '1px solid var(--border)',
                background: voiceSpeed === s ? 'rgba(29,158,117,0.1)' : 'var(--surface)',
                color: voiceSpeed === s ? '#1D9E75' : 'var(--muted)',
              }}>{['Lenta', 'Normal', 'Rápida'][i]}</button>
            ))}
          </div>
        </Field>
        <Field label="">
          <Toggle checked={humorEnabled} onChange={setHumorEnabled} label="Humor activado" desc="Stoqly puede hacer algún comentario gracioso de vez en cuando" />
        </Field>
      </Section>

      {/* 4 — Mi hogar */}
      <Section icon={<Home size={16} />} title="Mi hogar">
        <Field label="Nombre del hogar">
          <input value={householdName} onChange={e => setHouseholdName(e.target.value)} disabled={!editing} style={inp} />
        </Field>
        <Field label="Supermercado principal">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUPERMARKETS.map(s => (
              <button key={s} onClick={() => setSupermarket(s)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: supermarket === s ? '1px solid #1D9E75' : '1px solid var(--border)',
                background: supermarket === s ? 'rgba(29,158,117,0.1)' : 'var(--surface)',
                color: supermarket === s ? '#1D9E75' : 'var(--muted)',
              }}>{s}</button>
            ))}
          </div>
        </Field>

        {/* Dirección de entrega */}
        <Field label="Dirección de entrega para pedidos online">
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-8px 0 10px' }}>
            Donde el supermercado debe enviarte la compra cuando hagas un pedido.
          </p>
          <Field label="Nombre del destinatario">
            <input value={dirNombre} onChange={e => setDirNombre(e.target.value)} disabled={!editing} placeholder="Ej: Javier Torres" style={inp} />
          </Field>
          <Field label="Calle y número">
            <input value={dirCalle} onChange={e => setDirCalle(e.target.value)} disabled={!editing} placeholder="Ej: Calle Mayor, 14" style={inp} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
            <Field label="Piso/Puerta">
              <input value={dirPiso} onChange={e => setDirPiso(e.target.value)} disabled={!editing} placeholder="Ej: 3ºB" style={{ ...inp, marginBottom: 0 }} />
            </Field>
            <Field label="Ciudad">
              <input value={dirCiudad} onChange={e => setDirCiudad(e.target.value)} disabled={!editing} placeholder="Ej: Madrid" style={{ ...inp, marginBottom: 0 }} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, marginTop: 14 }}>
            <Field label="Código postal">
              <input value={dirCP} onChange={e => setDirCP(e.target.value.replace(/\D/g, '').slice(0, 5))} disabled={!editing} placeholder="28001" maxLength={5} style={{ ...inp, marginBottom: 0 }} />
            </Field>
            <Field label="Teléfono de contacto">
              <input value={dirTelefono} onChange={e => setDirTelefono(e.target.value)} disabled={!editing} placeholder="Ej: 612 345 678" style={{ ...inp, marginBottom: 0 }} />
            </Field>
          </div>
        </Field>

        {/* Zonas */}
        <Field label="Zonas de la despensa">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {zonesData?.map(z => (
              editingZone?.id === z.id ? (
                <div key={z.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={editingZone.icon} onChange={e => setEditingZone({ ...editingZone, icon: e.target.value })}
                    style={{ ...inp, width: 50, marginBottom: 0, textAlign: 'center', fontSize: 18 }} />
                  <input value={editingZone.name} onChange={e => setEditingZone({ ...editingZone, name: e.target.value })}
                    style={{ ...inp, flex: 1, marginBottom: 0 }} />
                  <button onClick={() => updateZone.mutate(editingZone)} style={btnSmallPri}>✓</button>
                  <button onClick={() => setEditingZone(null)} style={btnSmallSec}>✕</button>
                </div>
              ) : (
                <div key={z.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 18 }}>{z.icon}</span>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{z.name}</span>
                  <button onClick={() => setEditingZone(z)} style={btnIcon}><Pencil size={13} /></button>
                  <button onClick={() => deleteZone.mutate(z.id)} style={{ ...btnIcon, color: 'var(--danger)' }}><Trash2 size={13} /></button>
                </div>
              )
            ))}
          </div>
          {showAddZone ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={newZoneIcon} onChange={e => setNewZoneIcon(e.target.value)}
                placeholder="📦" style={{ ...inp, width: 50, marginBottom: 0, textAlign: 'center', fontSize: 18 }} />
              <input value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                placeholder="Nombre de la zona" style={{ ...inp, flex: 1, marginBottom: 0 }}
                onKeyDown={e => e.key === 'Enter' && newZoneName && addZone.mutate()} />
              <button onClick={() => newZoneName && addZone.mutate()} style={btnSmallPri}>Añadir</button>
              <button onClick={() => setShowAddZone(false)} style={btnSmallSec}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddZone(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'transparent', border: '1px dashed var(--border)', borderRadius: 8,
              color: 'var(--muted)', fontSize: 13, cursor: 'pointer', width: '100%',
            }}>
              <Plus size={14} /> Añadir zona
            </button>
          )}
        </Field>
      </Section>

      {/* 5 — Personas en casa */}
      <Section icon={<Users size={16} />} title="Personas en casa">
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
          Todos los miembros comparten la misma despensa y lista de la compra. Cada uno gestiona sus propias alergias desde su cuenta.
        </p>
        {data?.household?.members?.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.email} · {m.role}</div>
            </div>
            {m.id !== data.user.id && (
              <button onClick={() => removeMember.mutate(m.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
            onKeyDown={e => e.key === 'Enter' && inviteEmail && invite.mutate()}
            placeholder="Email de la persona a añadir" style={{ ...inp, flex: 1, marginBottom: 0 }} />
          <button onClick={() => invite.mutate()} disabled={!inviteEmail || invite.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !inviteEmail ? 0.5 : 1 }}>
            <UserPlus size={15} /> Añadir
          </button>
        </div>
        {inviteError && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0 0' }}>{inviteError}</p>}
        {inviteSuccess && <p style={{ color: '#1D9E75', fontSize: 13, margin: '8px 0 0' }}>✓ {inviteSuccess}</p>}
      </Section>

      {/* 6 — Categorías activas */}
      <Section icon={<Layers size={16} />} title="Categorías activas">
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
          Activa solo lo que usas. Cada categoría crea sus zonas y alertas específicas, y Stoqly aprende lo que necesita para ayudarte mejor.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CATEGORIAS.map(cat => {
            const active = categoriasActivas.includes(cat.id)
            const [bg, fg] = TIER_COLORS[cat.tier]
            return (
              <div key={cat.id} onClick={() => toggleCategoria(cat.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 12, cursor: cat.locked ? 'default' : 'pointer',
                border: active ? '1px solid #1D9E75' : '1px solid var(--border)',
                background: active ? 'rgba(29,158,117,0.06)' : 'var(--bg)',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{cat.label}</span>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 8, background: bg, color: fg, fontWeight: 600 }}>
                      {cat.tier}
                    </span>
                    {cat.locked && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Siempre activa</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{cat.desc}</div>
                </div>
                {!cat.locked && (
                  <div style={{
                    width: 42, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0,
                    background: active ? '#1D9E75' : 'var(--border)', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 3, left: active ? 21 : 3,
                      width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* 7 — Mis alergias */}
      <Section icon={<AlertTriangle size={16} />} title="Tus alergias e intolerancias">
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
          Estas son <strong>tus</strong> alergias personales. Stoqly las tiene en cuenta para recetas, compra y alertas de productos.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
          Cada persona del hogar gestiona las suyas desde su propia cuenta.
        </p>

        {/* Predefinidas */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {Object.entries(ALLERGEN_LABELS).map(([k, v]) => (
            <button key={k} onClick={() => toggleAllergen(k)} style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: allergens.includes(k) ? '1px solid #EF9F27' : '1px solid var(--border)',
              background: allergens.includes(k) ? 'rgba(239,159,39,0.12)' : 'var(--surface)',
              color: allergens.includes(k) ? '#EF9F27' : 'var(--muted)',
            }}>{v}</button>
          ))}
        </div>

        {/* Personalizadas */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px', fontWeight: 500 }}>
            Añadir alergia personalizada — escribe la que necesites
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={newAllergen} onChange={e => setNewAllergen(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAllergenPersonal()}
              placeholder="Ej: Frutas tropicales, Castañas, Apio..." style={{ ...inp, flex: 1, marginBottom: 0 }} />
            <button onClick={addAllergenPersonal} disabled={!newAllergen.trim()} style={{
              padding: '10px 14px', background: '#EF9F27', border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newAllergen.trim() ? 0.5 : 1,
            }}>
              <Plus size={15} />
            </button>
          </div>
          {alergiasPersonalizadas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {alergiasPersonalizadas.map(a => (
                <div key={a} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 20, background: 'rgba(239,159,39,0.12)', border: '1px solid #EF9F27',
                }}>
                  <span style={{ fontSize: 13, color: '#EF9F27' }}>{a}</span>
                  <button onClick={() => removeAllergenPersonal(a)} style={{ background: 'none', border: 'none', color: '#EF9F27', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* 8 — Accesibilidad */}
      <Section icon={<Accessibility size={16} />} title="Accesibilidad">
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
          Stoqly está diseñado para ser útil para cualquier persona. Estas opciones hacen la experiencia más cómoda según tus necesidades.
        </p>
        <Field label="Tamaño del texto">
          <div style={{ display: 'flex', gap: 8 }}>
            {['NORMAL', 'LARGE', 'XLARGE'].map((s, i) => (
              <button key={s} onClick={() => setTextSize(s)} style={{
                flex: 1, padding: '9px', borderRadius: 10, fontSize: [13, 15, 17][i], cursor: 'pointer',
                border: textSize === s ? '1px solid #1D9E75' : '1px solid var(--border)',
                background: textSize === s ? 'rgba(29,158,117,0.1)' : 'var(--surface)',
                color: textSize === s ? '#1D9E75' : 'var(--muted)',
              }}>{'Aa'}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>Normal · Grande · Muy grande</p>
        </Field>
        <Field label="">
          <Toggle checked={highContrast} onChange={setHighContrast} label="Alto contraste" desc="Mejora la visibilidad para personas con baja visión (WCAG AA)" />
        </Field>
        <Field label="">
          <Toggle checked={reduceMotion} onChange={setReduceMotion} label="Sin animaciones" desc="Elimina transiciones para personas con sensibilidad vestibular" />
        </Field>
        {/* Patrones de vibración */}
        <Field label="Patrones de vibración">
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-8px 0 12px' }}>
            Cada tipo de alerta tiene un patrón de vibración distinto y reconocible. Pulsa para probarlos.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'URGENT', icon: '🚨', label: 'Alerta urgente', desc: '3 cortos + 1 largo' },
              { key: 'ALERT', icon: '⚠️', label: 'Alerta normal', desc: '2 pulsos cortos' },
              { key: 'CONFIRM', icon: '✅', label: 'Confirmación', desc: '1 pulso suave' },
              { key: 'ERROR', icon: '❌', label: 'Error', desc: '2 pulsos largos' },
              { key: 'STOQLY', icon: '✦', label: 'Stoqly hablando', desc: '3 pulsos suaves' },
              { key: 'BABY', icon: '👶', label: 'Alerta bebé', desc: '4 pulsos rápidos (máxima atención)' },
            ].map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.desc}</div>
                  </div>
                </div>
                <button onClick={() => vibrate(p.key as keyof typeof VIBRATION_PATTERNS)} style={{
                  padding: '6px 12px', background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)',
                  borderRadius: 8, color: '#1D9E75', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Probar
                </button>
              </div>
            ))}
          </div>
        </Field>

        <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1D9E75', marginBottom: 4 }}>🎯 Objetivo: certificación ONCE</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Estamos trabajando para que Stoqly sea totalmente accesible según los estándares de la ONCE, incluyendo compatibilidad con lectores de pantalla (JAWS, NVDA, VoiceOver, TalkBack), navegación completa por teclado y estos patrones de vibración para usuarios con discapacidad visual.
          </div>
        </div>
      </Section>

      </div>
      {/* fin del área editable */}

      {/* 9 — Mis domicilios */}
      <Section icon={<Home size={16} />} title="Mis domicilios">
        {tier === 'FREE' ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: 'rgba(78,205,196,0.06)',
            border: '1px solid rgba(78,205,196,0.2)', borderRadius: 10,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Gestiona varios domicilios
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                ¿Tienes segunda casa? Con el plan Hogar puedes gestionar despensas separadas y saber qué tienes en cada una.
              </div>
            </div>
            <button onClick={() => navigate('/plans')} style={{
              flexShrink: 0, marginLeft: 16, padding: '8px 16px', borderRadius: 10,
              background: 'var(--teal)', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Ver planes
            </button>
          </div>
        ) : (
          <>
            {householdMsg && (
              <div style={{ fontSize: 13, color: 'var(--teal)', marginBottom: 10, fontWeight: 600 }}>{householdMsg}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {households?.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'var(--bg)',
                  borderRadius: 10, border: `1px solid ${h.isActive ? 'var(--teal)' : 'var(--border)'}`,
                }}>
                  <Home size={15} style={{ color: h.isActive ? 'var(--teal)' : 'var(--muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', fontWeight: h.isActive ? 600 : 400 }}>
                    {h.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{h.itemCount} productos</span>
                  {h.isActive && (
                    <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={11} /> Activo
                    </span>
                  )}
                  {!h.isActive && h.role === 'OWNER' && (
                    <button
                      onClick={() => deleteHousehold.mutate(h.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {showAddHousehold ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={newHouseholdName}
                  onChange={e => setNewHouseholdName(e.target.value)}
                  placeholder="Nombre del domicilio (ej: Casa de la playa)"
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: 13,
                  }}
                  onKeyDown={e => e.key === 'Enter' && newHouseholdName && addHousehold.mutate(newHouseholdName)}
                />
                <button
                  onClick={() => addHousehold.mutate(newHouseholdName)}
                  disabled={!newHouseholdName || addHousehold.isPending}
                  style={{ padding: '9px 16px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Añadir
                </button>
                <button onClick={() => setShowAddHousehold(false)} style={{ padding: '9px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowAddHousehold(true); setHouseholdMsg('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', background: 'none',
                  border: '1px dashed var(--border)', borderRadius: 10,
                  color: 'var(--teal)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Plus size={15} /> Añadir domicilio
              </button>
            )}
          </>
        )}
      </Section>

      {/* 10 — Suscripción */}
      <Section icon={<CreditCard size={16} />} title="Mi suscripción">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 12, marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Plan actual</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal)' }}>{tier}</div>
          </div>
          <button
            onClick={() => navigate('/plans')}
            style={{
              padding: '10px 20px', background: 'var(--teal)', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Zap size={15} />
            {tier === 'FREE' ? 'Mejorar plan' : 'Gestionar plan'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          Compara todos los planes y sus características en la página de Planes.
        </p>
      </Section>

      {/* Botón de guardado al final de la página, para no tener que volver arriba */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, marginBottom: 24 }}>
        <EditSaveButton />
      </div>
    </div>
  )
}

// ── Perfil nutricional ────────────────────────────────────────────────
const ACTIVIDAD_OPTS = [
  { key: 'SEDENTARIO',  label: 'Sedentario',   desc: 'Trabajo de oficina, sin ejercicio' },
  { key: 'LIGERO',      label: 'Ligero',        desc: 'Ejercicio 1-2 días/semana' },
  { key: 'MODERADO',    label: 'Moderado',      desc: 'Ejercicio 3-5 días/semana' },
  { key: 'ACTIVO',      label: 'Activo',        desc: 'Ejercicio intenso 6-7 días' },
  { key: 'MUY_ACTIVO',  label: 'Muy activo',   desc: 'Trabajo físico + entrenamiento' },
]
const OBJETIVO_OPTS = [
  { key: 'PERDER_PESO',      label: '⬇️ Perder peso',        desc: 'Déficit de ~400 kcal/día' },
  { key: 'MANTENER',         label: '⚖️ Mantenimiento',      desc: 'Mantener el peso actual' },
  { key: 'GANAR_MUSCULO',    label: '💪 Ganar masa muscular', desc: 'Superávit de ~300 kcal + más proteína' },
  { key: 'DIETA_ESPECIFICA', label: '🥗 Dieta específica',   desc: 'Mediterránea, cetogénica, etc.' },
]

function calcKcal(peso: number, altura: number, edad: number, actividad: string, objetivo: string) {
  const tmb = 10 * peso + 6.25 * altura - 5 * edad + 5
  const f: Record<string, number> = { SEDENTARIO: 1.2, LIGERO: 1.375, MODERADO: 1.55, ACTIVO: 1.725, MUY_ACTIVO: 1.9 }
  let kcal = Math.round(tmb * (f[actividad] ?? 1.55))
  let prot = Math.round(peso * 1.6)
  if (objetivo === 'PERDER_PESO') kcal -= 400
  if (objetivo === 'GANAR_MUSCULO') { kcal += 300; prot = Math.round(peso * 2.0) }
  return { kcal, prot }
}

function NutritionalSection({
  editing,
  pesoKg, setPesoKg, alturaCm, setAlturaCm, edadAnos, setEdadAnos,
  nivelActividad, setNivelActividad, objetivoNutricional, setObjetivoNutricional,
}: {
  editing: boolean
  pesoKg: string; setPesoKg: (v: string) => void
  alturaCm: string; setAlturaCm: (v: string) => void
  edadAnos: string; setEdadAnos: (v: string) => void
  nivelActividad: string; setNivelActividad: (v: string) => void
  objetivoNutricional: string; setObjetivoNutricional: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  // Auto-abrir cuando los datos del API llegan (después del primer render)
  useEffect(() => {
    if (pesoKg || alturaCm) setOpen(true)
  }, [pesoKg, alturaCm])

  const peso = parseFloat(pesoKg)
  const altura = parseFloat(alturaCm)
  const edad = parseInt(edadAnos)
  const completo = peso > 0 && altura > 0 && edad > 0 && nivelActividad && objetivoNutricional
  const resultado = completo ? calcKcal(peso, altura, edad, nivelActividad, objetivoNutricional) : null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1D9E75' }}>
          <Target size={16} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Objetivo nutricional</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>— opcional</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {resultado && (
            <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600 }}>
              {resultado.kcal} kcal · {resultado.prot}g prot/día
            </span>
          )}
          <span style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 18, ...editGate(editing) }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
            Si rellenas estos datos, Vicky podrá orientarte sobre qué comer según tu objetivo — calorías, proteínas, qué tienes en casa que encaja. Es completamente opcional.
          </p>

          {/* Datos físicos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Peso (kg)">
              <input
                type="number" value={pesoKg} onChange={e => setPesoKg(e.target.value)} disabled={!editing}
                placeholder="Ej: 75" min={30} max={250}
                style={{ ...inp, marginBottom: 0 }}
              />
            </Field>
            <Field label="Altura (cm)">
              <input
                type="number" value={alturaCm} onChange={e => setAlturaCm(e.target.value)} disabled={!editing}
                placeholder="Ej: 175" min={100} max={250}
                style={{ ...inp, marginBottom: 0 }}
              />
            </Field>
            <Field label="Edad">
              <input
                type="number" value={edadAnos} onChange={e => setEdadAnos(e.target.value)} disabled={!editing}
                placeholder="Ej: 35" min={10} max={120}
                style={{ ...inp, marginBottom: 0 }}
              />
            </Field>
          </div>

          {/* Nivel de actividad */}
          <Field label="Nivel de actividad física">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ACTIVIDAD_OPTS.map(o => (
                <button key={o.key} onClick={() => setNivelActividad(o.key)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: nivelActividad === o.key ? '1px solid #1D9E75' : '1px solid var(--border)',
                  background: nivelActividad === o.key ? 'rgba(29,158,117,0.08)' : 'var(--bg)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: nivelActividad === o.key ? '#1D9E75' : 'var(--text)' }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.desc}</div>
                  </div>
                  {nivelActividad === o.key && <Check size={14} style={{ color: '#1D9E75', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </Field>

          {/* Objetivo */}
          <Field label="¿Cuál es tu objetivo?">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {OBJETIVO_OPTS.map(o => (
                <button key={o.key} onClick={() => setObjetivoNutricional(o.key)} style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: objetivoNutricional === o.key ? '1px solid #1D9E75' : '1px solid var(--border)',
                  background: objetivoNutricional === o.key ? 'rgba(29,158,117,0.08)' : 'var(--bg)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: objetivoNutricional === o.key ? '#1D9E75' : 'var(--text)', marginBottom: 3 }}>{o.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          {/* Resultado */}
          {resultado ? (
            <div style={{
              padding: '14px 18px', borderRadius: 12,
              background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.25)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75', marginBottom: 8 }}>
                🎯 Tu objetivo diario estimado
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{resultado.kcal}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>kcal/día</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{resultado.prot}g</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>proteína/día</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 0' }}>
                Calculado con la fórmula Mifflin-St Jeor. Vicky usará estos datos para orientarte cuando le preguntes sobre alimentación.
              </p>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px dashed var(--border)', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              Rellena los datos para ver tu objetivo calórico estimado
            </div>
          )}

          {/* Borrar datos */}
          {(pesoKg || alturaCm || edadAnos) && (
            <button
              onClick={() => { setPesoKg(''); setAlturaCm(''); setEdadAnos(''); setNivelActividad(''); setObjetivoNutricional('') }}
              style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Eliminar datos nutricionales
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Actividad física ─────────────────────────────────────────────────
const DEPORTE_NIVEL_OPTS = [
  { key: 'PRINCIPIANTE', label: '🌱 Principiante', desc: 'Empezando o menos de 1 año' },
  { key: 'INTERMEDIO',   label: '🔥 Intermedio',   desc: '1-3 años de práctica regular' },
  { key: 'AVANZADO',     label: '⚡ Avanzado',     desc: 'Más de 3 años, alta intensidad' },
  { key: 'COMPETICION',  label: '🏆 Competición',  desc: 'Entrenas para competir' },
]

function SportSection({
  editing,
  deporte, setDeporte, deporteNivel, setDeporteNivel, deporteDiasSemana, setDeporteDiasSemana,
}: {
  editing: boolean
  deporte: string; setDeporte: (v: string) => void
  deporteNivel: string; setDeporteNivel: (v: string) => void
  deporteDiasSemana: string; setDeporteDiasSemana: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (deporte) setOpen(true) }, [deporte])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏃</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Actividad física</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>— opcional</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {deporte && (
            <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 600 }}>
              {deporte}{deporteDiasSemana ? ` · ${deporteDiasSemana}x/semana` : ''}
            </span>
          )}
          <span style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 18, ...editGate(editing) }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
            Con esta información Stoqly puede ayudarte mejor: suplementos adecuados para tu deporte, hidratación, recuperación, o qué comer antes y después de entrenar.
          </p>

          <Field label="¿Practicas algún deporte?">
            <input
              value={deporte}
              onChange={e => setDeporte(e.target.value)}
              disabled={!editing}
              placeholder="Ej: Running, Crossfit, Ciclismo, Natación, Gym..."
              style={{ ...inp, maxWidth: 360 }}
            />
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-10px 0 0' }}>
              Escríbelo como quieras — Stoqly lo entiende.
            </p>
          </Field>

          {deporte && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>Nivel</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DEPORTE_NIVEL_OPTS.map(o => (
                    <button key={o.key} onClick={() => setDeporteNivel(v => v === o.key ? '' : o.key)} style={{
                      padding: '10px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                      background: deporteNivel === o.key ? 'rgba(29,158,117,0.12)' : 'var(--bg)',
                      border: deporteNivel === o.key ? '1.5px solid #1D9E75' : '1.5px solid var(--border)',
                      color: 'var(--text)',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{o.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Días de entrenamiento por semana">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7].map(d => (
                    <button key={d} onClick={() => setDeporteDiasSemana(v => v === String(d) ? '' : String(d))} style={{
                      width: 40, height: 40, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      background: deporteDiasSemana === String(d) ? '#1D9E75' : 'var(--bg)',
                      border: deporteDiasSemana === String(d) ? '1.5px solid #1D9E75' : '1.5px solid var(--border)',
                      color: deporteDiasSemana === String(d) ? '#fff' : 'var(--text)',
                    }}>{d}</button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {deporte && (
            <button
              onClick={() => { setDeporte(''); setDeporteNivel(''); setDeporteDiasSemana('') }}
              style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Eliminar datos de actividad
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: '#1D9E75' }}>
        {icon}
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</label>}
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div style={{ width: 42, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0, background: checked ? '#1D9E75' : 'var(--border)', transition: 'background 0.2s' }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
      </div>
      <div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none',
}

// Atenúa y bloquea la interacción de los campos cuando no se está en modo edición
const editGate = (editing: boolean): React.CSSProperties => ({
  opacity: editing ? 1 : 0.55,
  pointerEvents: editing ? 'auto' : 'none',
  transition: 'opacity 0.15s',
})
const btnSmallPri: React.CSSProperties = { padding: '8px 12px', background: '#1D9E75', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnSmallSec: React.CSSProperties = { padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }
const btnIcon: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 4 }
