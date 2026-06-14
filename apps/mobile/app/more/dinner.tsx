import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, Pill, styles as ui } from '@/components/ui'

interface MenuItem { plato: string; tipo: 'entrante' | 'principal' | 'postre' | 'bebida'; tienes: string[]; necesitas: string[] }
interface MenuResponse { ocasion: string; menu: MenuItem[]; resumen: string; stoqlyMsg: string }
interface PrepPaso { plato: string; paso: string; duracion: string; consejo?: string }
interface PrepGuide { tiempoTotal: string; stoqlyMsg: string; ordenGeneral: string; pasos: PrepPaso[] }

const OCASIONES = [
  { id: 'cumple', icon: '🎂', label: 'Cumpleaños' },
  { id: 'navidad', icon: '🎄', label: 'Navidad' },
  { id: 'añonuevo', icon: '🥂', label: 'Año Nuevo' },
  { id: 'romantico', icon: '❤️', label: 'Cena romántica' },
  { id: 'amigos', icon: '🍻', label: 'Reunión de amigos' },
  { id: 'familia', icon: '👨‍👩‍👧', label: 'Comida familiar' },
  { id: 'verano', icon: '☀️', label: 'Barbacoa / verano' },
  { id: 'informal', icon: '🍕', label: 'Cena informal' },
  { id: 'otro', icon: '✨', label: 'Otra ocasión' },
]

const TIPO_ICON: Record<string, string> = { entrante: '🥗', principal: '🍽️', postre: '🍰', bebida: '🥂' }

function extractJSON(text: string): any {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
  const jsonStr = m ? (m[1] ?? m[0]) : text.trim()
  return JSON.parse(jsonStr)
}

export default function DinnerScreen() {
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
  const pantryItems: any[] = Array.isArray(pantryData) ? pantryData : (pantryData?.data ?? [])

  const addToList = useMutation({
    mutationFn: (name: string) => api.post('/shopping', { name, quantity: 1, unit: 'u' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })

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
        ? pantryItems.map(i => `${i.name} (${i.quantity}${i.unit}${i.daysUntilExpiry !== undefined ? `, caduca en ${i.daysUntilExpiry} días` : ''})`).join(', ')
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
      const res = await api.post<any>('/stoqly/chat', { message: prompt, history: [], maxTokens: 1800 })
      const text = res.reply ?? ''
      try {
        setMenu(extractJSON(text))
      } catch {
        setMenu({ ocasion: ocasionLabel, stoqlyMsg: text, resumen: '', menu: [] })
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
      try {
        setPrepGuide(extractJSON(text))
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
    const unique = [...new Set(menu.menu.flatMap(p => p.necesitas))]
    for (const item of unique) await addToList.mutateAsync(item)
    setAddedAll(true)
  }

  const allMissingItems = menu ? [...new Set(menu.menu.flatMap(p => p.necesitas))] : []

  return (
    <View style={ui.screen}>
      <ScreenHeader title="🍳 ¿Qué cocino?" subtitle="Cuéntame la ocasión y te propongo el menú" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Section title="Configura tu ocasión">
          <Text style={ui.fieldLabel}>¿Cuál es la ocasión?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {OCASIONES.map(o => (
              <Pill key={o.id} label={`${o.icon} ${o.label}`} active={ocasion === o.id} onPress={() => setOcasion(o.id)} />
            ))}
          </View>

          <Text style={ui.fieldLabel}>💡 ¿Tienes alguna idea o preferencia? (opcional)</Text>
          <TextInput value={idea} onChangeText={setIdea} placeholder="Ej: primero frío de cuchara, segundo de arroz..." placeholderTextColor={theme.muted} style={ui.input} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={ui.fieldLabel}>👥 Personas</Text>
              <TextInput value={personas} onChangeText={setPersonas} keyboardType="numeric" style={ui.input} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ui.fieldLabel}>📅 Fecha (AAAA-MM-DD)</Text>
              <TextInput value={fecha} onChangeText={setFecha} placeholder="2026-06-15" placeholderTextColor={theme.muted} style={ui.input} />
            </View>
          </View>
          <Text style={ui.fieldLabel}>Presupuesto € (opcional)</Text>
          <TextInput value={presupuesto} onChangeText={setPresupuesto} keyboardType="numeric" placeholder="Opcional" placeholderTextColor={theme.muted} style={ui.input} />

          <Text style={ui.fieldLabel}>Alergias o restricciones de los invitados (opcional)</Text>
          <TextInput value={alergias} onChangeText={setAlergias} placeholder="Ej: una persona celíaca, dos vegetarianos..." placeholderTextColor={theme.muted} style={ui.input} />

          <TouchableOpacity
            style={[styles.bigBtn, (!ocasion || loading) && { opacity: 0.5 }]}
            disabled={!ocasion || loading}
            onPress={generateMenu}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.bigBtnText}>👨‍🍳 Proponer menú</Text>}
          </TouchableOpacity>
        </Section>

        {menu && (
          <>
            {menu.stoqlyMsg ? (
              <View style={[ui.card, styles.stoqlyMsg]}>
                <Text style={styles.stoqlyIcon}>✦</Text>
                <Text style={styles.stoqlyMsgText}>{menu.stoqlyMsg}</Text>
              </View>
            ) : null}

            {menu.resumen ? <Text style={styles.resumen}>{menu.resumen}</Text> : null}

            {menu.menu?.map((plato, i) => (
              <View key={i} style={ui.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Text style={{ fontSize: 20 }}>{TIPO_ICON[plato.tipo] ?? '🍽️'}</Text>
                  <View>
                    <Text style={styles.platoName}>{plato.plato}</Text>
                    <Text style={styles.platoTipo}>{plato.tipo}</Text>
                  </View>
                </View>
                {plato.tienes?.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.tieneLabel}>✅ Ya tienes</Text>
                    {plato.tienes.map((ing, j) => <Text key={j} style={styles.ingText}>· {ing}</Text>)}
                  </View>
                )}
                {plato.necesitas?.length > 0 && (
                  <View>
                    <Text style={styles.necesitaLabel}>🛒 Necesitas comprar</Text>
                    {plato.necesitas.map((ing, j) => (
                      <View key={j} style={[ui.row, { marginBottom: 3 }]}>
                        <Text style={styles.ingText}>· {ing}</Text>
                        <TouchableOpacity onPress={() => addToList.mutate(ing)}>
                          <Text style={{ color: theme.brand, fontSize: 16 }}>＋</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {allMissingItems.length > 0 && (
              <View style={ui.card}>
                <Text style={styles.platoName}>🛒 {allMissingItems.length} ingredientes que necesitas comprar</Text>
                <Text style={[styles.ingText, { marginVertical: 8 }]}>{allMissingItems.join(' · ')}</Text>
                <TouchableOpacity
                  style={[styles.bigBtn, addedAll && { backgroundColor: '#0F6E56' }]}
                  disabled={addedAll || addToList.isPending}
                  onPress={addAllMissing}
                >
                  <Text style={styles.bigBtnText}>{addedAll ? '✓ Todo añadido a la lista' : '🛒 Añadir todo a la lista'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {!prepAsked && menu.menu?.length > 0 && (
              <View style={[ui.card, styles.stoqlyMsg, { flexDirection: 'column' }]}>
                <Text style={[styles.stoqlyMsgText, { marginBottom: 12 }]}>
                  ¿Necesitas ayuda para prepararlo? Puedo darte los pasos ordenados con los tiempos de cada plato para que todo salga perfecto y a la vez.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.bigBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }]} onPress={generatePrepGuide}>
                    <Text style={styles.bigBtnText}>👨‍🍳 Sí, ayúdame</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[ui.secondaryBtn, { flex: 1, marginHorizontal: 0, marginTop: 0 }]} onPress={() => setPrepAsked(true)}>
                    <Text style={ui.secondaryBtnText}>No, gracias</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loadingPrep && (
              <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <ActivityIndicator color={theme.brand} />
                <Text style={{ color: theme.muted, fontSize: 14 }}>Stoqly está calculando los pasos y tiempos...</Text>
              </View>
            )}

            {prepGuide && !loadingPrep && (
              <>
                <View style={[ui.card, styles.stoqlyMsg, { flexDirection: 'column' }]}>
                  <Text style={styles.stoqlyMsgText}>{prepGuide.stoqlyMsg}</Text>
                  {prepGuide.tiempoTotal ? <Text style={[styles.tiempoTotal, { marginTop: 8 }]}>⏱ Tiempo total: {prepGuide.tiempoTotal}</Text> : null}
                  {prepGuide.ordenGeneral ? <Text style={[styles.ingText, { marginTop: 6, fontStyle: 'italic' }]}>{prepGuide.ordenGeneral}</Text> : null}
                </View>

                {prepGuide.pasos?.map((paso, i) => {
                  const done = doneSteps.has(i)
                  return (
                    <TouchableOpacity key={i} style={[ui.card, styles.pasoCard, done && styles.pasoCardDone]} onPress={() => toggleStep(i)} activeOpacity={0.8}>
                      <View style={styles.pasoCircle}>
                        <Text style={{ color: done ? theme.brand : theme.muted, fontSize: 12, fontWeight: '700' }}>{done ? '✓' : i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <Text style={styles.pasoPlato}>{paso.plato}</Text>
                          {paso.duracion ? <Text style={styles.pasoDuracion}>⏱ {paso.duracion}</Text> : null}
                        </View>
                        <Text style={[styles.pasoText, done && { color: theme.muted, textDecorationLine: 'line-through' }]}>{paso.paso}</Text>
                        {paso.consejo && !done ? <Text style={styles.pasoConsejo}>💡 {paso.consejo}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  )
                })}

                {prepGuide.pasos?.length > 0 && (
                  <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${(doneSteps.size / prepGuide.pasos.length) * 100}%` }]} />
                    </View>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>
                      {doneSteps.size}/{prepGuide.pasos.length} pasos{doneSteps.size === prepGuide.pasos.length ? ' 🎉' : ''}
                    </Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={ui.secondaryBtn} onPress={generateMenu}>
              <Text style={ui.secondaryBtnText}>🔄 Proponer otro menú</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  bigBtn: { backgroundColor: theme.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  bigBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stoqlyMsg: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(29,158,117,0.07)', borderColor: 'rgba(29,158,117,0.2)' },
  stoqlyIcon: { color: theme.brand, fontSize: 16 },
  stoqlyMsgText: { color: theme.text, fontSize: 13, flex: 1, lineHeight: 18 },
  resumen: { color: theme.muted, fontSize: 13, fontStyle: 'italic', marginHorizontal: 20, marginBottom: 12 },
  platoName: { color: theme.text, fontSize: 15, fontWeight: '700' },
  platoTipo: { color: theme.muted, fontSize: 11, textTransform: 'uppercase' },
  tieneLabel: { color: theme.brand, fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  necesitaLabel: { color: theme.danger, fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  ingText: { color: theme.text, fontSize: 13 },
  tiempoTotal: { color: theme.brand, fontSize: 13, fontWeight: '700' },
  pasoCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pasoCardDone: { backgroundColor: 'rgba(29,158,117,0.06)', borderColor: 'rgba(29,158,117,0.3)', opacity: 0.7 },
  pasoCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  pasoPlato: { color: theme.brand, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  pasoDuracion: { fontSize: 11, color: theme.warn, fontWeight: '600' },
  pasoText: { color: theme.text, fontSize: 14, lineHeight: 19 },
  pasoConsejo: { color: theme.muted, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  progressTrack: { flex: 1, height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.brand, borderRadius: 3 },
})
