import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { theme } from '@/theme'
import { ScreenHeader, Section, ToggleRow, EmptyState, styles as ui } from '@/components/ui'

interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  startAt: string
  endAt?: string | null
  allDay: boolean
  reminder: boolean
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function dayLabel(key: string): string {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)

  if (key === todayKey) return 'Hoy'
  if (key === tomorrowKey) return 'Mañana'

  const date = new Date(`${key}T00:00:00`)
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function toDateInput(iso?: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function toTimeInput(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toTimeString().slice(0, 5)
}

function buildIso(date: string, time: string, allDay: boolean): string | null {
  if (!date) return null
  try {
    if (allDay || !time) return new Date(`${date}T00:00:00`).toISOString()
    return new Date(`${date}T${time}:00`).toISOString()
  } catch {
    return null
  }
}

export default function CalendarScreen() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => api.get<{ events: CalendarEvent[] }>('/calendar'),
    refetchInterval: 60000,
  })

  const events = data?.events ?? []

  const add = useMutation({
    mutationFn: (payload: any) => api.post('/calendar', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); setAdding(false) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/calendar/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); setEditingId(null) },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  })

  const confirmDelete = (ev: CalendarEvent) => {
    Alert.alert('Eliminar evento', `¿Eliminar "${ev.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(ev.id) },
    ])
  }

  const groups: Record<string, CalendarEvent[]> = {}
  for (const ev of events) {
    const key = dayKey(ev.startAt)
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  }
  const sortedKeys = Object.keys(groups).sort()

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScreenHeader title="Calendario" subtitle={`${events.length} próximo${events.length !== 1 ? 's' : ''} evento${events.length !== 1 ? 's' : ''}`} />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: theme.teal }]} onPress={() => setAdding(a => !a)}>
            <Text style={[styles.actionBtnText, { color: theme.teal }]}>＋ Añadir evento</Text>
          </TouchableOpacity>
        </View>

        {adding && (
          <Section title="Nuevo evento">
            <EventForm onSave={(payload) => add.mutate(payload)} onCancel={() => setAdding(false)} loading={add.isPending} />
          </Section>
        )}

        {isLoading ? (
          <ActivityIndicator color={theme.teal} style={{ marginTop: 40 }} />
        ) : sortedKeys.length === 0 ? (
          <EmptyState icon="📅" title="Sin eventos en el calendario" desc="Añade citas, cumpleaños o recordatorios y Stoqly te avisará cuando se acerquen" />
        ) : (
          sortedKeys.map(key => (
            <View key={key} style={{ marginBottom: 8 }}>
              <Text style={styles.dayTitle}>{dayLabel(key)}</Text>
              {groups[key].map(ev => (
                <View key={ev.id}>
                  {editingId === ev.id ? (
                    <Section title="Editar evento">
                      <EventForm initial={ev} onSave={(payload) => update.mutate({ id: ev.id, data: payload })} onCancel={() => setEditingId(null)} loading={update.isPending} />
                    </Section>
                  ) : (
                    <View style={ui.card}>
                      <View style={ui.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.title}>📅 {ev.title}</Text>
                          <View style={styles.metaRow}>
                            {ev.allDay ? (
                              <Text style={styles.meta}>Todo el día</Text>
                            ) : (
                              <Text style={styles.meta}>🕐 {timeLabel(ev.startAt)}{ev.endAt ? ` – ${timeLabel(ev.endAt)}` : ''}</Text>
                            )}
                            <Text style={styles.meta}>{ev.reminder ? '🔔 Recordatorio activo' : '🔕 Sin recordatorio'}</Text>
                          </View>
                          {ev.description ? <Text style={styles.desc}>{ev.description}</Text> : null}
                        </View>
                        <View style={styles.cardActions}>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingId(ev.id)}>
                            <Text style={styles.iconBtnText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.danger + '22' }]} onPress={() => confirmDelete(ev)}>
                            <Text style={styles.iconBtnText}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

function EventForm({ initial, onSave, onCancel, loading }: {
  initial?: CalendarEvent
  onSave: (data: any) => void
  onCancel: () => void
  loading: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(toDateInput(initial?.startAt) || new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(toTimeInput(initial?.startAt))
  const [allDay, setAllDay] = useState(initial?.allDay ?? false)
  const [reminder, setReminder] = useState(initial?.reminder ?? true)

  function handleSave() {
    const startAt = buildIso(date, time, allDay)
    if (!title.trim() || !startAt) return
    onSave({
      title: title.trim(),
      description: description?.trim() || null,
      startAt,
      allDay,
      reminder,
    })
  }

  return (
    <View>
      <Text style={ui.fieldLabel}>Título</Text>
      <TextInput style={ui.input} value={title} onChangeText={setTitle} placeholder="Ej: Cita médica, cumpleaños, revisión coche..." placeholderTextColor={theme.muted} />

      <Text style={ui.fieldLabel}>Fecha</Text>
      <TextInput style={ui.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={theme.muted} />

      {!allDay && (
        <>
          <Text style={ui.fieldLabel}>Hora (opcional)</Text>
          <TextInput style={ui.input} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={theme.muted} />
        </>
      )}

      <ToggleRow label="Todo el día" value={allDay} onValueChange={setAllDay} />
      <ToggleRow label="Stoqly me avisará antes" value={reminder} onValueChange={setReminder} />

      <Text style={ui.fieldLabel}>Descripción (opcional)</Text>
      <TextInput style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]} value={description ?? ''} onChangeText={setDescription} multiline placeholder="Detalles adicionales..." placeholderTextColor={theme.muted} />

      <View style={styles.formActions}>
        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnSec]} onPress={onCancel}>
          <Text style={[styles.smallBtnText, { color: theme.text }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: theme.teal, opacity: (!title.trim() || !date || loading) ? 0.5 : 1 }]}
          disabled={!title.trim() || !date || loading}
          onPress={handleSave}
        >
          {loading ? <ActivityIndicator color="#0F0F1A" /> : <Text style={[styles.smallBtnText, { color: '#0F0F1A' }]}>{initial ? 'Guardar cambios' : 'Añadir evento'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  actionBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  dayTitle: { color: theme.teal, fontSize: 13, fontWeight: '800', textTransform: 'capitalize', marginHorizontal: 20, marginBottom: 8 },

  title: { color: theme.text, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  meta: { color: theme.muted, fontSize: 12 },
  desc: { color: theme.muted, fontSize: 13, marginTop: 8 },

  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 14 },

  formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  smallBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  smallBtnText: { fontWeight: '700', fontSize: 13 },
  smallBtnSec: { borderWidth: 1, borderColor: theme.border },
})
