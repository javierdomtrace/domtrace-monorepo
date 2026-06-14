import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, Pill, EmptyState, styles as ui } from '@/components/ui'

const ACCENT = '#E879A0'

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

function ageLabel(months: number): string {
  if (months < 1) return 'recién nacido'
  if (months < 24) return `${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem ? `${years} a ${rem} m` : `${years} años`
}

function feedingLabel(type: Feeding['type']): string {
  return {
    PECHO_IZQUIERDO: '🤱 Pecho izq.',
    PECHO_DERECHO: '🤱 Pecho der.',
    BIBERON: '🍼 Biberón',
    SOLIDOS: '🥣 Sólidos',
  }[type]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} d`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

const TABS = ['tomas', 'mediciones', 'stock', 'medicamentos'] as const
const TAB_LABELS: Record<typeof TABS[number], string> = {
  tomas: '🍼 Tomas', mediciones: '📏 Mediciones', stock: '📦 Stock', medicamentos: '💊 Medicamentos',
}

export default function BabyScreen() {
  const qc = useQueryClient()
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const [tab, setTab] = useState<typeof TABS[number]>('tomas')
  const [showAddBaby, setShowAddBaby] = useState(false)
  const [showAddFeeding, setShowAddFeeding] = useState(false)
  const [showAddMeasurement, setShowAddMeasurement] = useState(false)

  const { data: babiesData } = useQuery({
    queryKey: ['babies'],
    queryFn: () => api.get<Baby[]>('/babies'),
  })
  const babies = babiesData ?? []
  const baby = babies.find(b => b.id === selectedBabyId) ?? babies[0] ?? null

  useEffect(() => {
    if (!selectedBabyId && babies.length > 0) setSelectedBabyId(babies[0].id)
  }, [babies, selectedBabyId])

  const { data: feedingsData } = useQuery({
    queryKey: ['baby-feedings', baby?.id],
    queryFn: () => api.get<{ feedings: Feeding[]; summary: any }>(`/baby-feedings?babyId=${baby!.id}`),
    enabled: !!baby,
  })
  const feedings = feedingsData?.feedings ?? []
  const feedingSummary = feedingsData?.summary ?? null

  const { data: measureData } = useQuery({
    queryKey: ['baby-measurements', baby?.id],
    queryFn: () => api.get<{ measurements: Measurement[]; latest: Measurement | null }>(`/baby-measurements?babyId=${baby!.id}`),
    enabled: !!baby,
  })
  const measurements = measureData?.measurements ?? []
  const latestM = measureData?.latest ?? null

  const { data: stockData } = useQuery({
    queryKey: ['baby-stock', baby?.id],
    queryFn: () => api.get<{ items: BabyItem[] }>(`/supplements?babyId=${baby!.id}&categoryId=BEBES`),
    enabled: !!baby && tab === 'stock',
  })
  const stockItems = stockData?.items ?? []

  const { data: medsData } = useQuery({
    queryKey: ['baby-meds', baby?.id],
    queryFn: () => api.get<{ items: BabyItem[] }>(`/medications?babyId=${baby!.id}`),
    enabled: !!baby && tab === 'medicamentos',
  })
  const medItems = medsData?.items ?? []

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

  const confirmDeleteBaby = () => {
    if (!baby) return
    Alert.alert('Eliminar perfil', `¿Eliminar el perfil de ${baby.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteBaby.mutate(baby.id) },
    ])
  }

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScreenHeader title="Bebés" subtitle={baby ? `${baby.name} · ${ageLabel(baby.ageMonths)}` : undefined} />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: ACCENT }]} onPress={() => setShowAddBaby(s => !s)}>
            <Text style={[styles.actionBtnText, { color: ACCENT }]}>＋ Añadir bebé</Text>
          </TouchableOpacity>
        </View>

        {babies.length > 0 && (
          <View style={styles.pillsRow}>
            {babies.map(b => (
              <Pill key={b.id} label={`${b.gender === 'F' ? '👧' : b.gender === 'M' ? '👦' : '👶'} ${b.name} · ${ageLabel(b.ageMonths)}`}
                active={b.id === baby?.id} onPress={() => setSelectedBabyId(b.id)} color={ACCENT} />
            ))}
          </View>
        )}

        {showAddBaby && (
          <Section title="Nuevo bebé">
            <AddBabyForm onSubmit={d => addBaby.mutate(d)} loading={addBaby.isPending} />
          </Section>
        )}

        {!baby && babies.length === 0 && !showAddBaby && (
          <EmptyState icon="👶" title="Sin bebés" desc="Añade tu primer bebé para empezar" />
        )}

        {baby && (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Última toma" value={feedings[0] ? timeAgo(feedings[0].feedingAt) : '—'} />
              <StatCard label="Tomas hoy" value={`${feedingSummary?.totalToday ?? 0}`} />
              <StatCard label="Peso" value={latestM?.weight ? `${latestM.weight} kg` : '—'} />
              <StatCard label="Talla" value={latestM?.height ? `${latestM.height} cm` : '—'} />
            </View>

            <View style={styles.tabsRow}>
              {TABS.map(t => (
                <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { borderBottomColor: ACCENT }]}>
                  <Text style={[styles.tabText, tab === t && { color: ACCENT, fontWeight: '800' }]}>{TAB_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'tomas' && (
              <Section title="Tomas">
                <TouchableOpacity style={[styles.smallAddBtn, { borderColor: ACCENT }]} onPress={() => setShowAddFeeding(s => !s)}>
                  <Text style={[styles.smallAddBtnText, { color: ACCENT }]}>＋ Registrar toma</Text>
                </TouchableOpacity>
                {showAddFeeding && (
                  <AddFeedingForm babyId={baby.id} onSubmit={d => addFeeding.mutate(d)} loading={addFeeding.isPending} />
                )}
                {feedings.length === 0 && <Text style={styles.emptyText}>Sin tomas registradas</Text>}
                {feedings.map(f => (
                  <View key={f.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{feedingLabel(f.type)}</Text>
                      <Text style={styles.itemMeta}>
                        {f.amountMl ? `${f.amountMl} ml · ` : ''}
                        {f.durationMin ? `${f.durationMin} min · ` : ''}
                        {f.amountG ? `${f.amountG} g · ` : ''}
                        {timeAgo(f.feedingAt)} · {formatDate(f.feedingAt)}
                        {f.notes ? ` · ${f.notes}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteFeeding.mutate(f.id)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </Section>
            )}

            {tab === 'mediciones' && (
              <Section title="Mediciones">
                <TouchableOpacity style={[styles.smallAddBtn, { borderColor: ACCENT }]} onPress={() => setShowAddMeasurement(s => !s)}>
                  <Text style={[styles.smallAddBtnText, { color: ACCENT }]}>＋ Registrar medición</Text>
                </TouchableOpacity>
                {showAddMeasurement && (
                  <AddMeasurementForm babyId={baby.id} onSubmit={d => addMeasurement.mutate(d)} loading={addMeasurement.isPending} />
                )}
                {measurements.length === 0 && <Text style={styles.emptyText}>Sin mediciones registradas</Text>}
                {measurements.map(m => (
                  <View key={m.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.chipsRow}>
                        {m.weight ? <View style={styles.chip}><Text style={styles.chipText}>⚖️ {m.weight} kg</Text></View> : null}
                        {m.height ? <View style={styles.chip}><Text style={styles.chipText}>📏 {m.height} cm</Text></View> : null}
                        {m.headCirc ? <View style={styles.chip}><Text style={styles.chipText}>🔵 PC {m.headCirc} cm</Text></View> : null}
                      </View>
                      <Text style={styles.itemMeta}>{formatDate(m.measuredAt)}{m.notes ? ` · ${m.notes}` : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteMeasurement.mutate(m.id)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </Section>
            )}

            {tab === 'stock' && (
              <Section title="Stock de bebé">
                <Text style={styles.helpText}>Leche de fórmula, papillas, potitos, pañales, toallitas… vinculados a {baby.name}.</Text>
                {stockItems.length === 0 && <Text style={styles.emptyText}>Sin productos de bebé</Text>}
                {stockItems.map(item => (
                  <View key={item.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemMeta}>{item.quantity} {item.unit}</Text>
                    </View>
                    {item.lowStock && <View style={styles.badge}><Text style={styles.badgeText}>Stock bajo</Text></View>}
                  </View>
                ))}
              </Section>
            )}

            {tab === 'medicamentos' && (
              <Section title="Medicamentos de bebé">
                <Text style={styles.helpText}>Paracetamol infantil, ibuprofeno, gotas… vinculados a {baby.name}.</Text>
                {medItems.length === 0 && <Text style={styles.emptyText}>Sin medicamentos registrados</Text>}
                {medItems.map(item => (
                  <View key={item.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        {item.quantity} {item.unit}{item.expiryDate ? ` · cad. ${formatDate(item.expiryDate)}` : ''}
                      </Text>
                    </View>
                    {item.lowStock && <View style={styles.badge}><Text style={styles.badgeText}>Stock bajo</Text></View>}
                  </View>
                ))}
              </Section>
            )}

            <TouchableOpacity style={styles.deleteBabyBtn} onPress={confirmDeleteBaby}>
              <Text style={styles.deleteBabyBtnText}>🗑 Eliminar perfil de {baby.name}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function AddBabyForm({ onSubmit, loading }: { onSubmit: (d: any) => void; loading: boolean }) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | ''>('')

  return (
    <View>
      <Text style={ui.fieldLabel}>Nombre</Text>
      <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={theme.muted} />
      <Text style={ui.fieldLabel}>Fecha de nacimiento</Text>
      <TextInput style={ui.input} value={birthDate} onChangeText={setBirthDate} placeholder="AAAA-MM-DD" placeholderTextColor={theme.muted} />
      <Text style={ui.fieldLabel}>Sexo (opcional)</Text>
      <View style={styles.pillsRow}>
        <Pill label="👦 Niño" active={gender === 'M'} onPress={() => setGender(gender === 'M' ? '' : 'M')} color={ACCENT} />
        <Pill label="👧 Niña" active={gender === 'F'} onPress={() => setGender(gender === 'F' ? '' : 'F')} color={ACCENT} />
      </View>
      <TouchableOpacity
        style={[ui.primaryBtn, { backgroundColor: ACCENT, marginHorizontal: 0, opacity: (name && birthDate) ? 1 : 0.5 }]}
        disabled={!name || !birthDate || loading}
        onPress={() => onSubmit({ name, birthDate, gender: gender || undefined })}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  )
}

function AddFeedingForm({ babyId, onSubmit, loading }: { babyId: string; onSubmit: (d: any) => void; loading: boolean }) {
  const [type, setType] = useState<Feeding['type']>('BIBERON')
  const [amountMl, setAmountMl] = useState('')
  const [amountG, setAmountG] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <View style={styles.subForm}>
      <Text style={ui.fieldLabel}>Tipo</Text>
      <View style={styles.pillsRow}>
        <Pill label="🍼 Biberón" active={type === 'BIBERON'} onPress={() => setType('BIBERON')} color={ACCENT} />
        <Pill label="🤱 Pecho izq." active={type === 'PECHO_IZQUIERDO'} onPress={() => setType('PECHO_IZQUIERDO')} color={ACCENT} />
        <Pill label="🤱 Pecho der." active={type === 'PECHO_DERECHO'} onPress={() => setType('PECHO_DERECHO')} color={ACCENT} />
        <Pill label="🥣 Sólidos" active={type === 'SOLIDOS'} onPress={() => setType('SOLIDOS')} color={ACCENT} />
      </View>

      {type === 'BIBERON' && (
        <>
          <Text style={ui.fieldLabel}>Cantidad (ml)</Text>
          <TextInput style={ui.input} value={amountMl} onChangeText={setAmountMl} keyboardType="numeric" placeholder="ej. 120" placeholderTextColor={theme.muted} />
        </>
      )}
      {(type === 'PECHO_IZQUIERDO' || type === 'PECHO_DERECHO') && (
        <>
          <Text style={ui.fieldLabel}>Duración (min)</Text>
          <TextInput style={ui.input} value={durationMin} onChangeText={setDurationMin} keyboardType="numeric" placeholder="ej. 15" placeholderTextColor={theme.muted} />
        </>
      )}
      {type === 'SOLIDOS' && (
        <>
          <Text style={ui.fieldLabel}>Cantidad (g)</Text>
          <TextInput style={ui.input} value={amountG} onChangeText={setAmountG} keyboardType="numeric" placeholder="ej. 80" placeholderTextColor={theme.muted} />
        </>
      )}
      <Text style={ui.fieldLabel}>Notas (opcional)</Text>
      <TextInput style={ui.input} value={notes} onChangeText={setNotes} placeholder="…" placeholderTextColor={theme.muted} />

      <TouchableOpacity
        style={[ui.primaryBtn, { backgroundColor: ACCENT, marginHorizontal: 0, opacity: loading ? 0.5 : 1 }]}
        disabled={loading}
        onPress={() => onSubmit({
          babyId, type,
          amountMl: type === 'BIBERON' ? (parseFloat(amountMl) || undefined) : undefined,
          durationMin: (type === 'PECHO_IZQUIERDO' || type === 'PECHO_DERECHO') ? (parseInt(durationMin) || undefined) : undefined,
          amountG: type === 'SOLIDOS' ? (parseFloat(amountG) || undefined) : undefined,
          notes: notes || undefined,
        })}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  )
}

function AddMeasurementForm({ babyId, onSubmit, loading }: { babyId: string; onSubmit: (d: any) => void; loading: boolean }) {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [headCirc, setHeadCirc] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <View style={styles.subForm}>
      <Text style={ui.fieldLabel}>Peso (kg)</Text>
      <TextInput style={ui.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="ej. 5.2" placeholderTextColor={theme.muted} />
      <Text style={ui.fieldLabel}>Talla (cm)</Text>
      <TextInput style={ui.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="ej. 62" placeholderTextColor={theme.muted} />
      <Text style={ui.fieldLabel}>Per. cefálico (cm)</Text>
      <TextInput style={ui.input} value={headCirc} onChangeText={setHeadCirc} keyboardType="numeric" placeholder="ej. 40" placeholderTextColor={theme.muted} />
      <Text style={ui.fieldLabel}>Notas</Text>
      <TextInput style={ui.input} value={notes} onChangeText={setNotes} placeholder="…" placeholderTextColor={theme.muted} />

      <TouchableOpacity
        style={[ui.primaryBtn, { backgroundColor: ACCENT, marginHorizontal: 0, opacity: (!weight && !height && !headCirc) || loading ? 0.5 : 1 }]}
        disabled={(!weight && !height && !headCirc) || loading}
        onPress={() => onSubmit({
          babyId,
          weight: parseFloat(weight) || undefined,
          height: parseFloat(height) || undefined,
          headCirc: parseFloat(headCirc) || undefined,
          notes: notes || undefined,
        })}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryBtnText}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  actionBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 16 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flexBasis: '48%', flexGrow: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14 },
  statValue: { color: theme.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: theme.muted, fontSize: 12, marginTop: 2 },

  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, paddingHorizontal: 20, marginBottom: 16 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { color: theme.muted, fontSize: 13, fontWeight: '600' },

  smallAddBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
  smallAddBtnText: { fontSize: 13, fontWeight: '700' },

  subForm: { backgroundColor: theme.bg, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  itemTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  itemMeta: { color: theme.muted, fontSize: 12, marginTop: 2 },
  helpText: { color: theme.muted, fontSize: 13, marginBottom: 12 },
  emptyText: { color: theme.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { color: theme.text, fontSize: 12 },

  iconBtn: { padding: 6 },
  iconBtnText: { fontSize: 16 },

  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: theme.danger + '22' },
  badgeText: { color: theme.danger, fontSize: 11, fontWeight: '700' },

  deleteBabyBtn: { marginHorizontal: 20, marginTop: 20, borderWidth: 1, borderColor: theme.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteBabyBtnText: { color: theme.danger, fontSize: 13, fontWeight: '700' },
})
