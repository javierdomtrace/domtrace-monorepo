import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Baby as BabyIcon, Plus, Trash2, Scale, Ruler, Clock, Droplets,
  Utensils, Pill, Package, ChevronDown, ChevronUp, Edit2, Check, X,
} from 'lucide-react'
import { api } from '../lib/api'

// ── Tipos ─────────────────────────────────────────────────────────────

interface Baby {
  id: string
  name: string
  birthDate: string
  gender: 'M' | 'F' | null
  ageMonths: number
}

interface Feeding {
  id: string
  babyId: string
  type: 'PECHO_IZQUIERDO' | 'PECHO_DERECHO' | 'BIBERON' | 'SOLIDOS'
  amountMl?: number
  amountG?: number
  durationMin?: number
  notes?: string
  feedingAt: string
}

interface Measurement {
  id: string
  babyId: string
  weight?: number
  height?: number
  headCirc?: number
  measuredAt: string
  notes?: string
}

interface BabyItem {
  id: string
  name: string
  quantity: number
  unit: string
  expiryDate?: string
  lowStock: boolean
  categoryId: string
}

// ── Helpers ───────────────────────────────────────────────────────────

const ACCENT = '#E879A0'  // rosa bebé
const ACCENT_LIGHT = 'rgba(232,121,160,0.10)'

function ageLabel(months: number): string {
  if (months < 1)  return 'recién nacido'
  if (months < 24) return `${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  const rem   = months % 12
  return rem ? `${years} a ${rem} m` : `${years} años`
}

function feedingLabel(type: Feeding['type']): string {
  return {
    PECHO_IZQUIERDO: '🤱 Pecho izq.',
    PECHO_DERECHO:   '🤱 Pecho der.',
    BIBERON:         '🍼 Biberón',
    SOLIDOS:         '🥣 Sólidos',
  }[type]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} d`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// ── Componente principal ──────────────────────────────────────────────

export function BabyPage() {
  const qc = useQueryClient()
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'tomas' | 'mediciones' | 'stock' | 'medicamentos'>('tomas')
  const [showAddBaby, setShowAddBaby] = useState(false)
  const [showAddFeeding, setShowAddFeeding] = useState(false)
  const [showAddMeasurement, setShowAddMeasurement] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)

  // ── Bebés ────────────────────────────────────────────────────────────

  const { data: babiesData } = useQuery({
    queryKey: ['babies'],
    queryFn: () => api.get<Baby[]>('/babies'),
  })
  const babies = babiesData ?? []
  const baby = babies.find(b => b.id === selectedBabyId) ?? babies[0] ?? null

  // Seleccionar el primero automáticamente
  React.useEffect(() => {
    if (!selectedBabyId && babies.length > 0) setSelectedBabyId(babies[0].id)
  }, [babies, selectedBabyId])

  // ── Tomas ────────────────────────────────────────────────────────────

  const { data: feedingsData } = useQuery({
    queryKey: ['baby-feedings', baby?.id],
    queryFn: () => api.get<{ feedings: Feeding[]; summary: any }>(`/baby-feedings?babyId=${baby!.id}`),
    enabled: !!baby,
  })
  const feedings  = feedingsData?.feedings ?? []
  const feedingSummary = feedingsData?.summary ?? null

  // ── Mediciones ───────────────────────────────────────────────────────

  const { data: measureData } = useQuery({
    queryKey: ['baby-measurements', baby?.id],
    queryFn: () => api.get<{ measurements: Measurement[]; latest: Measurement | null }>(`/baby-measurements?babyId=${baby!.id}`),
    enabled: !!baby,
  })
  const measurements = measureData?.measurements ?? []
  const latestM      = measureData?.latest ?? null

  // ── Stock bebé ───────────────────────────────────────────────────────

  const { data: stockData } = useQuery({
    queryKey: ['baby-stock', baby?.id],
    queryFn: () => api.get<{ items: BabyItem[] }>(`/supplements?babyId=${baby!.id}&categoryId=BEBES`),
    enabled: !!baby && tab === 'stock',
  })
  const stockItems = stockData?.items ?? []

  // ── Medicamentos bebé ────────────────────────────────────────────────

  const { data: medsData } = useQuery({
    queryKey: ['baby-meds', baby?.id],
    queryFn: () => api.get<{ items: BabyItem[] }>(`/medications?babyId=${baby!.id}`),
    enabled: !!baby && tab === 'medicamentos',
  })
  const medItems = medsData?.items ?? []

  // ── Mutations ────────────────────────────────────────────────────────

  const addBaby = useMutation({
    mutationFn: (data: any) => api.post('/babies', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['babies'] }); setShowAddBaby(false) },
  })

  const deleteBaby = useMutation({
    mutationFn: (id: string) => api.delete(`/babies/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['babies'] }); setSelectedBabyId(null) },
  })

  const addFeeding = useMutation({
    mutationFn: (data: any) => api.post('/baby-feedings', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['baby-feedings', baby?.id] }); setShowAddFeeding(false) },
  })

  const deleteFeeding = useMutation({
    mutationFn: (id: string) => api.delete(`/baby-feedings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['baby-feedings', baby?.id] }),
  })

  const addMeasurement = useMutation({
    mutationFn: (data: any) => api.post('/baby-measurements', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['baby-measurements', baby?.id] }); setShowAddMeasurement(false) },
  })

  const deleteMeasurement = useMutation({
    mutationFn: (id: string) => api.delete(`/baby-measurements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['baby-measurements', baby?.id] }),
  })

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BabyIcon size={28} style={{ color: ACCENT }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Bebés</h1>
        </div>
        <button onClick={() => setShowAddBaby(true)} style={btnStyle(ACCENT)}>
          <Plus size={16} /> Añadir bebé
        </button>
      </div>

      {/* Selector de bebé */}
      {babies.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {babies.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBabyId(b.id)}
              style={{
                padding: '8px 18px', borderRadius: 20, border: `2px solid ${b.id === baby?.id ? ACCENT : 'var(--border)'}`,
                background: b.id === baby?.id ? ACCENT_LIGHT : 'var(--surface)',
                color: b.id === baby?.id ? ACCENT : 'var(--muted)',
                fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {b.gender === 'F' ? '👧' : b.gender === 'M' ? '👦' : '👶'} {b.name}
              <span style={{ fontSize: 12, opacity: 0.8 }}>· {ageLabel(b.ageMonths)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Formulario nuevo bebé */}
      {showAddBaby && <AddBabyForm onSubmit={data => addBaby.mutate(data)} onCancel={() => setShowAddBaby(false)} loading={addBaby.isPending} />}

      {!baby && babies.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <BabyIcon size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Añade tu primer bebé para empezar</p>
        </div>
      )}

      {baby && (
        <>
          {/* Resumen del bebé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard icon={<Clock size={18} />} label="Última toma" value={feedings[0] ? timeAgo(feedings[0].feedingAt) : '—'} />
            <StatCard icon={<Droplets size={18} />} label="Tomas hoy" value={`${feedingSummary?.totalToday ?? 0}`} />
            <StatCard icon={<Scale size={18} />} label="Peso" value={latestM?.weight ? `${latestM.weight} kg` : '—'} />
            <StatCard icon={<Ruler size={18} />} label="Talla" value={latestM?.height ? `${latestM.height} cm` : '—'} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {(['tomas', 'mediciones', 'stock', 'medicamentos'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 16px', background: 'none', border: 'none',
                borderBottom: tab === t ? `2px solid ${ACCENT}` : '2px solid transparent',
                color: tab === t ? ACCENT : 'var(--muted)',
                fontWeight: tab === t ? 700 : 500, fontSize: 14, cursor: 'pointer',
                textTransform: 'capitalize', marginBottom: -1,
              }}>
                {{ tomas: '🍼 Tomas', mediciones: '📏 Mediciones', stock: '📦 Stock', medicamentos: '💊 Medicamentos' }[t]}
              </button>
            ))}
          </div>

          {/* ── Tab: Tomas ── */}
          {tab === 'tomas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button onClick={() => setShowAddFeeding(true)} style={btnStyle(ACCENT)}>
                  <Plus size={16} /> Registrar toma
                </button>
              </div>
              {showAddFeeding && (
                <AddFeedingForm
                  babyId={baby.id}
                  onSubmit={data => addFeeding.mutate(data)}
                  onCancel={() => setShowAddFeeding(false)}
                  loading={addFeeding.isPending}
                />
              )}
              {feedings.length === 0 && <Empty text="Sin tomas registradas" />}
              {feedings.map(f => (
                <div key={f.id} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span style={{ fontSize: 20 }}>{{ PECHO_IZQUIERDO: '🤱', PECHO_DERECHO: '🤱', BIBERON: '🍼', SOLIDOS: '🥣' }[f.type]}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{feedingLabel(f.type)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {f.amountMl ? `${f.amountMl} ml · ` : ''}
                        {f.durationMin ? `${f.durationMin} min · ` : ''}
                        {f.amountG ? `${f.amountG} g · ` : ''}
                        {timeAgo(f.feedingAt)} · {formatDate(f.feedingAt)}
                        {f.notes ? ` · ${f.notes}` : ''}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteFeeding.mutate(f.id)} style={iconBtn} aria-label="Eliminar toma"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Mediciones ── */}
          {tab === 'mediciones' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button onClick={() => setShowAddMeasurement(true)} style={btnStyle(ACCENT)}>
                  <Plus size={16} /> Registrar medición
                </button>
              </div>
              {showAddMeasurement && (
                <AddMeasurementForm
                  babyId={baby.id}
                  onSubmit={data => addMeasurement.mutate(data)}
                  onCancel={() => setShowAddMeasurement(false)}
                  loading={addMeasurement.isPending}
                />
              )}
              {measurements.length === 0 && <Empty text="Sin mediciones registradas" />}
              {measurements.map(m => (
                <div key={m.id} style={cardStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
                      {m.weight   && <Chip label={`⚖️ ${m.weight} kg`} />}
                      {m.height   && <Chip label={`📏 ${m.height} cm`} />}
                      {m.headCirc && <Chip label={`🔵 PC ${m.headCirc} cm`} />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {formatDate(m.measuredAt)}{m.notes ? ` · ${m.notes}` : ''}
                    </div>
                  </div>
                  <button onClick={() => deleteMeasurement.mutate(m.id)} style={iconBtn} aria-label="Eliminar medición"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Stock ── */}
          {tab === 'stock' && (
            <div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                Leche de fórmula, papillas, potitos, pañales, toallitas… Los artículos de esta sección están vinculados a {baby.name}.
              </p>
              {stockItems.length === 0 && <Empty text="Sin productos de bebé" />}
              {stockItems.map(item => (
                <div key={item.id} style={cardStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.quantity} {item.unit}</div>
                  </div>
                  {item.lowStock && <span style={badge('var(--danger)')}>Stock bajo</span>}
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Medicamentos ── */}
          {tab === 'medicamentos' && (
            <div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
                Paracetamol infantil, ibuprofeno, gotas… vinculados a {baby.name}.
              </p>
              {medItems.length === 0 && <Empty text="Sin medicamentos registrados" />}
              {medItems.map(item => (
                <div key={item.id} style={cardStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {item.quantity} {item.unit}
                      {item.expiryDate ? ` · cad. ${formatDate(item.expiryDate)}` : ''}
                    </div>
                  </div>
                  {item.lowStock && <span style={badge('var(--danger)')}>Stock bajo</span>}
                </div>
              ))}
            </div>
          )}

          {/* Eliminar bebé */}
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => { if (confirm(`¿Eliminar el perfil de ${baby.name}?`)) deleteBaby.mutate(baby.id) }}
              style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={14} /> Eliminar perfil de {baby.name}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-formularios ───────────────────────────────────────────────────

function AddBabyForm({ onSubmit, onCancel, loading }: { onSubmit: (d: any) => void; onCancel: () => void; loading: boolean }) {
  const [name, setName]           = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender]       = useState<'M' | 'F' | ''>('')

  return (
    <div style={formCard}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text)' }}>Nuevo bebé</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Nombre</label>
          <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" />
        </div>
        <div>
          <label style={lbl}>Fecha de nacimiento</label>
          <input type="date" style={inp} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Sexo (opcional)</label>
          <select style={inp} value={gender} onChange={e => setGender(e.target.value as any)}>
            <option value="">—</option>
            <option value="M">Niño</option>
            <option value="F">Niña</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSubmit({ name, birthDate, gender: gender || undefined })} disabled={!name || !birthDate || loading} style={btnStyle('#E879A0')}>
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel} style={btnSecondary}>Cancelar</button>
      </div>
    </div>
  )
}

function AddFeedingForm({ babyId, onSubmit, onCancel, loading }: { babyId: string; onSubmit: (d: any) => void; onCancel: () => void; loading: boolean }) {
  const [type, setType]             = useState<'PECHO_IZQUIERDO' | 'PECHO_DERECHO' | 'BIBERON' | 'SOLIDOS'>('BIBERON')
  const [amountMl, setAmountMl]     = useState('')
  const [amountG, setAmountG]       = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [notes, setNotes]           = useState('')

  return (
    <div style={formCard}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text)' }}>Registrar toma</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Tipo</label>
          <select style={inp} value={type} onChange={e => setType(e.target.value as any)}>
            <option value="BIBERON">🍼 Biberón</option>
            <option value="PECHO_IZQUIERDO">🤱 Pecho izquierdo</option>
            <option value="PECHO_DERECHO">🤱 Pecho derecho</option>
            <option value="SOLIDOS">🥣 Sólidos</option>
          </select>
        </div>
        {type === 'BIBERON' && (
          <div>
            <label style={lbl}>Cantidad (ml)</label>
            <input type="number" style={inp} value={amountMl} onChange={e => setAmountMl(e.target.value)} placeholder="ej. 120" />
          </div>
        )}
        {(type === 'PECHO_IZQUIERDO' || type === 'PECHO_DERECHO') && (
          <div>
            <label style={lbl}>Duración (min)</label>
            <input type="number" style={inp} value={durationMin} onChange={e => setDurationMin(e.target.value)} placeholder="ej. 15" />
          </div>
        )}
        {type === 'SOLIDOS' && (
          <div>
            <label style={lbl}>Cantidad (g)</label>
            <input type="number" style={inp} value={amountG} onChange={e => setAmountG(e.target.value)} placeholder="ej. 80" />
          </div>
        )}
        <div>
          <label style={lbl}>Notas (opcional)</label>
          <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSubmit({
            babyId, type,
            amountMl:    type === 'BIBERON'                                             ? (parseFloat(amountMl) || undefined) : undefined,
            durationMin: (type === 'PECHO_IZQUIERDO' || type === 'PECHO_DERECHO')       ? (parseInt(durationMin) || undefined) : undefined,
            amountG:     type === 'SOLIDOS'                                             ? (parseFloat(amountG) || undefined)  : undefined,
            notes: notes || undefined,
          })}
          disabled={loading}
          style={btnStyle('#E879A0')}
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel} style={btnSecondary}>Cancelar</button>
      </div>
    </div>
  )
}

function AddMeasurementForm({ babyId, onSubmit, onCancel, loading }: { babyId: string; onSubmit: (d: any) => void; onCancel: () => void; loading: boolean }) {
  const [weight, setWeight]     = useState('')
  const [height, setHeight]     = useState('')
  const [headCirc, setHeadCirc] = useState('')
  const [notes, setNotes]       = useState('')

  return (
    <div style={formCard}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text)' }}>Nueva medición</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Peso (kg)</label>
          <input type="number" step="0.01" style={inp} value={weight} onChange={e => setWeight(e.target.value)} placeholder="ej. 5.2" />
        </div>
        <div>
          <label style={lbl}>Talla (cm)</label>
          <input type="number" step="0.1" style={inp} value={height} onChange={e => setHeight(e.target.value)} placeholder="ej. 62" />
        </div>
        <div>
          <label style={lbl}>Per. cefálico (cm)</label>
          <input type="number" step="0.1" style={inp} value={headCirc} onChange={e => setHeadCirc(e.target.value)} placeholder="ej. 40" />
        </div>
        <div>
          <label style={lbl}>Notas</label>
          <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="…" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSubmit({
            babyId,
            weight:   parseFloat(weight)   || undefined,
            height:   parseFloat(height)   || undefined,
            headCirc: parseFloat(headCirc) || undefined,
            notes:    notes || undefined,
          })}
          disabled={(!weight && !height && !headCirc) || loading}
          style={btnStyle('#E879A0')}
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel} style={btnSecondary}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Micro-componentes ─────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: ACCENT, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

function Chip({ label }: { label: string }) {
  return (
    <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 13 }}>
      {label}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>{text}</p>
}

// ── Estilos ───────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: '12px 16px', marginBottom: 8,
}

const formCard: React.CSSProperties = {
  background: 'var(--surface)', border: `1px solid ${ACCENT}`,
  borderRadius: 14, padding: 20, marginBottom: 20,
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)',
  cursor: 'pointer', padding: 6, borderRadius: 6,
  display: 'flex', alignItems: 'center',
}

function btnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    background: color, color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 16px', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  }
}

const btnSecondary: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)',
  color: 'var(--muted)', borderRadius: 8, padding: '8px 16px',
  fontSize: 14, cursor: 'pointer',
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4,
}

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13,
  boxSizing: 'border-box',
}

function badge(color: string): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700, padding: '2px 8px',
    borderRadius: 6, background: color + '20', color,
  }
}
