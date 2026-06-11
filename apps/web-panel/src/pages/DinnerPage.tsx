import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ChefHat, Users, Calendar, ShoppingCart, RefreshCw, Plus, Lightbulb, Clock, CheckCircle2 } from 'lucide-react'

interface MenuItem {
  plato: string
  tipo: 'entrante' | 'principal' | 'postre' | 'bebida'
  tienes: string[]
  necesitas: string[]
}

interface MenuResponse {
  ocasion: string
  menu: MenuItem[]
  resumen: string
  stoqlyMsg: string
}

interface PrepPaso {
  plato: string
  paso: string
  duracion: string
  consejo?: string
}

interface PrepGuide {
  tiempoTotal: string
  stoqlyMsg: string
  ordenGeneral: string
  pasos: PrepPaso[]
}

const OCASIONES = [
  { id: 'cumple',    icon: '🎂', label: 'Cumpleaños' },
  { id: 'navidad',   icon: '🎄', label: 'Navidad' },
  { id: 'añonuevo',  icon: '🥂', label: 'Año Nuevo' },
  { id: 'romantico', icon: '❤️', label: 'Cena romántica' },
  { id: 'amigos',    icon: '🍻', label: 'Reunión de amigos' },
  { id: 'familia',   icon: '👨‍👩‍👧', label: 'Comida familiar' },
  { id: 'verano',    icon: '☀️', label: 'Barbacoa / verano' },
  { id: 'informal',  icon: '🍕', label: 'Cena informal' },
  { id: 'otro',      icon: '✨', label: 'Otra ocasión' },
]

export function DinnerPage() {
  const qc = useQueryClient()
  const [ocasion, setOcasion] = useState('')
  const [personas, setPersonas] = useState('4')
  const [fecha, setFecha] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0])
  const [alergias, setAlergias] = useState('')
  const [presupuesto, setPresupuesto] = useState('')
  const [idea, setIdea] = useState('')
  const [menu, setMenu] = useState<MenuResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [addedAll, setAddedAll] = useState(false)
  const [prepGuide, setPrepGuide] = useState<PrepGuide | null>(null)
  const [loadingPrep, setLoadingPrep] = useState(false)
  const [prepAsked, setPrepAsked] = useState(false)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())

  const { data: pantryData } = useQuery<any>({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?limit=100&sort=expiryDate&order=asc'),
  })

  const addToList = useMutation({
    mutationFn: (name: string) => api.post('/shopping', { name, quantity: 1, unit: 'u' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

  const pantryItems: any[] = Array.isArray(pantryData) ? pantryData : (pantryData?.data ?? [])

  const generateMenu = async () => {
    if (!ocasion) return
    setLoading(true)
    setMenu(null)
    setAddedAll(false)
    setPrepGuide(null)
    setPrepAsked(false)
    setDoneSteps(new Set())

    try {
      const pantryList = pantryItems.length > 0
        ? pantryItems.map(i =>
            `${i.name} (${i.quantity}${i.unit}${i.daysUntilExpiry !== undefined ? `, caduca en ${i.daysUntilExpiry} días` : ''})`
          ).join(', ')
        : 'despensa vacía'

      const ocasionLabel = OCASIONES.find(o => o.id === ocasion)?.label ?? ocasion

      const prompt = `Quiero organizar una ${ocasionLabel} el ${fecha} para ${personas} personas.
${alergias ? `Restricciones alimentarias de los invitados: ${alergias}.` : ''}
${presupuesto ? `Presupuesto aproximado: ${presupuesto}€.` : ''}
${idea ? `Preferencias o ideas concretas: ${idea}.` : ''}

Despensa actual (para saber qué ya tengo): ${pantryList}.

TAREA: Propón un menú COMPLETO y espectacular para la ocasión. No te limites a lo que hay en casa — propón los platos que realmente queden bien para una ${ocasionLabel}. Para cada plato indica:
1. Qué ingredientes ya tengo en casa (busca en la despensa actual)
2. Qué necesito comprar

Responde ÚNICAMENTE con JSON válido, sin texto antes ni después:
{
  "ocasion": "${ocasionLabel}",
  "stoqlyMsg": "mensaje amigable de Stoqly presentando el menú (1-2 frases con humor si procede)",
  "resumen": "descripción breve del menú completo",
  "menu": [
    {
      "plato": "nombre del plato",
      "tipo": "entrante|principal|postre|bebida",
      "tienes": ["ingrediente ya en casa"],
      "necesitas": ["ingrediente que hay que comprar"]
    }
  ]
}`

      const res = await api.post<any>('/stoqly/chat', {
        message: prompt,
        history: [],
        maxTokens: 1800,
      })

      const text = res.reply ?? ''
      // Extraer JSON — puede venir con markdown code blocks o sin ellos
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text.trim()

      try {
        const parsed = JSON.parse(jsonStr)
        setMenu(parsed)
      } catch {
        // Si no es JSON parseable, mostrar el texto como mensaje de Stoqly
        setMenu({
          ocasion: ocasionLabel,
          stoqlyMsg: text,
          resumen: '',
          menu: [],
        })
      }
    } catch (e) {
      console.error('Error generando menú:', e)
    } finally {
      setLoading(false)
    }
  }

  const generatePrepGuide = async () => {
    if (!menu) return
    setLoadingPrep(true)
    setPrepAsked(true)
    try {
      const platosStr = menu.menu.map(p => `- ${p.plato} (${p.tipo}): ingredientes ${[...p.tienes, ...p.necesitas].join(', ')}`).join('\n')
      const prompt = `Voy a preparar este menú para ${personas} personas (${OCASIONES.find(o => o.id === ocasion)?.label ?? ocasion}):
${platosStr}

Dame una guía de preparación paso a paso, ordenada cronológicamente para que todo esté listo a la vez. Incluye tiempos reales y consejos prácticos.

Responde ÚNICAMENTE con JSON válido:
{
  "tiempoTotal": "tiempo total estimado de preparación (ej: 1h 45min)",
  "stoqlyMsg": "mensaje motivador de Stoqly para empezar a cocinar (1 frase)",
  "ordenGeneral": "resumen de la secuencia lógica (ej: Empieza por X mientras se hace Y, al final monta Z)",
  "pasos": [
    {
      "plato": "nombre del plato al que pertenece este paso",
      "paso": "descripción clara de qué hacer",
      "duracion": "tiempo estimado (ej: 20 min)",
      "consejo": "truco o consejo opcional para que salga mejor"
    }
  ]
}`

      const res = await api.post<any>('/stoqly/chat', { message: prompt, history: [], maxTokens: 1800 })
      const text = res.reply ?? ''
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text.trim()
      try {
        setPrepGuide(JSON.parse(jsonStr))
      } catch {
        setPrepGuide({ tiempoTotal: '', stoqlyMsg: text, ordenGeneral: '', pasos: [] })
      }
    } catch (e) {
      console.error('Error generando guía:', e)
    } finally {
      setLoadingPrep(false)
    }
  }

  const toggleStep = (i: number) => setDoneSteps(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  const addAllMissing = async () => {
    if (!menu) return
    const allMissing = menu.menu.flatMap(p => p.necesitas)
    const unique = [...new Set(allMissing)]
    for (const item of unique) {
      await addToList.mutateAsync(item)
    }
    setAddedAll(true)
  }

  const allMissingItems = menu ? [...new Set(menu.menu.flatMap(p => p.necesitas))] : []

  return (
    <div style={{ maxWidth: 740 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <ChefHat size={28} color="#1D9E75" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>¿Qué cocino?</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Cuéntame la ocasión y Stoqly te propone el menú con lo que necesitas.
          </p>
        </div>
      </div>

      {/* Configurador */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 24 }}>

        {/* Ocasión */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>¿Cuál es la ocasión?</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OCASIONES.map(o => (
              <button key={o.id} onClick={() => setOcasion(o.id)} style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                border: ocasion === o.id ? '1px solid #1D9E75' : '1px solid var(--border)',
                background: ocasion === o.id ? 'rgba(29,158,117,0.12)' : 'var(--bg)',
                color: ocasion === o.id ? '#1D9E75' : 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {o.icon} {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Idea libre */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>
            <Lightbulb size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            ¿Tienes alguna idea o preferencia? <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span>
          </label>
          <input
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder="Ej: quiero un primero frío de cuchara, un segundo de arroz y postres ligeros..."
            style={inp}
          />
        </div>

        {/* Personas, fecha, presupuesto */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={lbl}><Users size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Personas</label>
            <input type="number" min="1" max="50" value={personas} onChange={e => setPersonas(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}><Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, colorScheme: 'dark' }} />
          </div>
          <div>
            <label style={lbl}>Presupuesto (€)</label>
            <input type="number" value={presupuesto} onChange={e => setPresupuesto(e.target.value)} placeholder="Opcional" style={inp} />
          </div>
        </div>

        {/* Alergias invitados */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Alergias o restricciones de los invitados <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
          <input value={alergias} onChange={e => setAlergias(e.target.value)}
            placeholder="Ej: una persona celíaca, dos vegetarianos, alguien intolerante a la lactosa..."
            style={inp} />
        </div>

        <button onClick={generateMenu} disabled={!ocasion || loading} style={{
          width: '100%', padding: '14px', borderRadius: 12, border: 'none',
          cursor: !ocasion || loading ? 'not-allowed' : 'pointer',
          background: !ocasion ? 'var(--border)' : '#1D9E75',
          color: '#fff', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: !ocasion ? 0.5 : 1,
        }}>
          {loading
            ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Stoqly está eligiendo el menú...</>
            : <><ChefHat size={18} /> Proponer menú</>
          }
        </button>
      </div>

      {/* Resultado */}
      {menu && (
        <div>
          {/* Mensaje de Stoqly */}
          {menu.stoqlyMsg && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20,
              padding: '14px 16px', background: 'rgba(29,158,117,0.07)',
              border: '1px solid rgba(29,158,117,0.2)', borderRadius: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#1D9E75',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0, color: '#fff',
              }}>✦</div>
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{menu.stoqlyMsg}</div>
            </div>
          )}

          {/* Resumen */}
          {menu.resumen && (
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, fontStyle: 'italic' }}>{menu.resumen}</p>
          )}

          {/* Platos */}
          {menu.menu?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {menu.menu.map((plato, i) => (
                <div key={i} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px 18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>
                      {plato.tipo === 'entrante' ? '🥗' : plato.tipo === 'principal' ? '🍽️' : plato.tipo === 'postre' ? '🍰' : '🥂'}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{plato.plato}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{plato.tipo}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {plato.tienes?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: '#1D9E75', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          ✅ Ya tienes
                        </div>
                        {plato.tienes.map((ing, j) => (
                          <div key={j} style={{ fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>· {ing}</div>
                        ))}
                      </div>
                    )}
                    {plato.necesitas?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: '#E24B4A', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          🛒 Necesitas comprar
                        </div>
                        {plato.necesitas.map((ing, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 13, color: 'var(--text)' }}>· {ing}</span>
                            <button onClick={() => addToList.mutate(ing)} style={{
                              background: 'none', border: 'none', color: '#1D9E75', cursor: 'pointer', padding: 2, display: 'flex',
                            }}>
                              <Plus size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Añadir todo a la lista */}
          {allMissingItems.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                🛒 {allMissingItems.length} ingredientes que necesitas comprar
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                {allMissingItems.join(' · ')}
              </div>
              <button onClick={addAllMissing} disabled={addedAll || addToList.isPending} style={{
                width: '100%', padding: '12px',
                background: addedAll ? '#0F6E56' : '#1D9E75',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: addedAll ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <ShoppingCart size={16} />
                {addedAll ? '✓ Todo añadido a la lista' : 'Añadir todo a la lista de la compra'}
              </button>
            </div>
          )}

          {/* ── Ayuda para preparar ── */}
          {!prepAsked && menu.menu?.length > 0 && (
            <div style={{
              marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '16px 18px', background: 'rgba(29,158,117,0.07)',
              border: '1px solid rgba(29,158,117,0.2)', borderRadius: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#1D9E75', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16,
              }}>✦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12, lineHeight: 1.6 }}>
                  ¿Necesitas ayuda para prepararlo? Puedo darte los pasos ordenados con los tiempos de cada plato para que todo salga perfecto y a la vez.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={generatePrepGuide} style={{
                    padding: '9px 18px', background: '#1D9E75', border: 'none', borderRadius: 10,
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <ChefHat size={14} /> Sí, ayúdame a prepararlo
                  </button>
                  <button onClick={() => setPrepAsked(true)} style={{
                    padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                  }}>
                    No, gracias
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cargando guía */}
          {loadingPrep && (
            <div style={{
              marginTop: 16, padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 14,
            }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', color: '#1D9E75' }} />
              Stoqly está calculando los pasos y tiempos...
            </div>
          )}

          {/* Guía de preparación */}
          {prepGuide && !loadingPrep && (
            <div style={{ marginTop: 16 }}>
              {/* Header guía */}
              <div style={{
                background: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.2)',
                borderRadius: 12, padding: '16px 18px', marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#1D9E75', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14,
                  }}>✦</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{prepGuide.stoqlyMsg}</div>
                </div>
                {prepGuide.tiempoTotal && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: prepGuide.ordenGeneral ? 8 : 0 }}>
                    <Clock size={14} color="#1D9E75" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>Tiempo total: {prepGuide.tiempoTotal}</span>
                  </div>
                )}
                {prepGuide.ordenGeneral && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {prepGuide.ordenGeneral}
                  </div>
                )}
              </div>

              {/* Pasos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prepGuide.pasos?.map((paso, i) => {
                  const done = doneSteps.has(i)
                  return (
                    <div key={i} onClick={() => toggleStep(i)} style={{
                      background: done ? 'rgba(29,158,117,0.06)' : 'var(--surface)',
                      border: `1px solid ${done ? 'rgba(29,158,117,0.3)' : 'var(--border)'}`,
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      transition: 'all 0.15s', opacity: done ? 0.65 : 1,
                      display: 'flex', gap: 14, alignItems: 'flex-start',
                    }}>
                      <div style={{ flexShrink: 0, marginTop: 2 }}>
                        {done
                          ? <CheckCircle2 size={20} color="#1D9E75" />
                          : <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              border: '2px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                            }}>{i + 1}</div>
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1D9E75', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {paso.plato}
                          </span>
                          {paso.duracion && (
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 20,
                              background: 'rgba(239,159,39,0.12)', color: '#EF9F27', fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              <Clock size={10} /> {paso.duracion}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, color: done ? 'var(--muted)' : 'var(--text)', lineHeight: 1.5, textDecoration: done ? 'line-through' : 'none' }}>
                          {paso.paso}
                        </div>
                        {paso.consejo && !done && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, fontStyle: 'italic' }}>
                            💡 {paso.consejo}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Progreso */}
              {prepGuide.pasos?.length > 0 && (
                <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: '#1D9E75', borderRadius: 3,
                      width: `${(doneSteps.size / prepGuide.pasos.length) * 100}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
                    {doneSteps.size}/{prepGuide.pasos.length} pasos
                    {doneSteps.size === prepGuide.pasos.length && ' 🎉'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Regenerar */}
          <button onClick={generateMenu} style={{
            marginTop: 12, width: '100%', padding: '10px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)',
            fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <RefreshCw size={14} /> Proponer otro menú
          </button>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 500,
}
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 14, boxSizing: 'border-box', outline: 'none',
}
