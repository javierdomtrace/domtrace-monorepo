import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { CalendarDays, Plus, Trash2, Edit2, Clock, Bell, BellOff, X } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  title: string
  description?: string | null
  startAt: string
  endAt?: string | null
  allDay: boolean
  reminder: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────

function dayKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
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

function buildIso(date: string, time: string, allDay: boolean): string {
  if (!date) return ''
  if (allDay || !time) return new Date(`${date}T00:00:00`).toISOString()
  return new Date(`${date}T${time}:00`).toISOString()
}

// ── Componente principal ──────────────────────────────────────────────

export function CalendarPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => api.get<{ events: CalendarEvent[] }>('/calendar'),
    refetchInterval: 60_000,
  })

  const events = data?.events ?? []

  const add = useMutation({
    mutationFn: (payload: any) => api.post('/calendar', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      setAdding(false)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/calendar/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
      setEditingId(null)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-events'] }),
  })

  // Agrupar eventos por día
  const groups: Record<string, CalendarEvent[]> = {}
  for (const ev of events) {
    const key = dayKey(ev.startAt)
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  }
  const sortedKeys = Object.keys(groups).sort()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Calendario</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {events.length} próximo{events.length !== 1 ? 's' : ''} evento{events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setAdding(v => !v)} style={btnPrimary} aria-expanded={adding}>
          <Plus size={16} /> Añadir evento
        </button>
      </div>

      {/* Formulario añadir */}
      {adding && (
        <EventForm
          onSave={(payload) => add.mutate(payload)}
          onCancel={() => setAdding(false)}
          loading={add.isPending}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Cargando...</div>
      ) : sortedKeys.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sortedKeys.map(key => (
            <div key={key}>
              <h2 style={{
                margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--teal)',
                textTransform: 'capitalize', letterSpacing: 0.3,
              }}>
                {dayLabel(key)}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {groups[key].map(ev => (
                  <div key={ev.id}>
                    {editingId === ev.id ? (
                      <EventForm
                        initial={ev}
                        onSave={(payload) => update.mutate({ id: ev.id, data: payload })}
                        onCancel={() => setEditingId(null)}
                        loading={update.isPending}
                      />
                    ) : (
                      <EventCard
                        event={ev}
                        onEdit={() => setEditingId(ev.id)}
                        onDelete={() => {
                          if (confirm(`¿Eliminar "${ev.title}"?`)) remove.mutate(ev.id)
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de evento ────────────────────────────────────────────────

function EventCard({ event, onEdit, onDelete }: {
  event: CalendarEvent
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 18px',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: 'rgba(78,205,196,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CalendarDays size={18} style={{ color: 'var(--teal)' }} aria-hidden="true" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{event.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {event.allDay ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Todo el día</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
              <Clock size={12} aria-hidden="true" />
              {timeLabel(event.startAt)}
              {event.endAt && ` – ${timeLabel(event.endAt)}`}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
            {event.reminder
              ? <Bell size={12} aria-hidden="true" />
              : <BellOff size={12} aria-hidden="true" />}
            {event.reminder ? 'Recordatorio activo' : 'Sin recordatorio'}
          </span>
        </div>
        {event.description && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>{event.description}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onEdit} aria-label={`Editar ${event.title}`}
          style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--muted)' }}
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={onDelete} aria-label={`Eliminar ${event.title}`}
          style={{ ...iconBtn, background: 'rgba(226,75,74,0.1)', color: 'var(--danger)' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Formulario de evento (crear/editar) ─────────────────────────────────

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
      description: description.trim() || null,
      startAt,
      allDay,
      reminder,
    })
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--teal)',
      borderRadius: 14, padding: '20px 24px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
          {initial ? 'Editar evento' : 'Nuevo evento'}
        </span>
        <button onClick={onCancel} aria-label="Cerrar formulario" style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--muted)' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Título</label>
        <input
          autoFocus value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Ej: Cita médica, cumpleaños, revisión coche..."
          style={inp}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: allDay ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, colorScheme: 'dark' }} />
        </div>
        {!allDay && (
          <div>
            <label style={labelStyle}>Hora (opcional)</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inp, colorScheme: 'dark' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
          Todo el día
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={reminder} onChange={e => setReminder(e.target.checked)} />
          Stoqly me avisará antes
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Descripción (opcional)</label>
        <input
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Detalles adicionales..."
          style={inp}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSec}>Cancelar</button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || !date || loading}
          style={{ ...btnPrimary, opacity: (!title.trim() || !date || loading) ? 0.6 : 1 }}
        >
          {loading ? 'Guardando...' : initial ? 'Guardar cambios' : 'Añadir evento'}
        </button>
      </div>
    </div>
  )
}

// ── Estado vacío ──────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 20px',
      background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
        Sin eventos en el calendario
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 14, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
        Añade citas, cumpleaños o recordatorios y Stoqly te avisará cuando se acerquen.
      </p>
      <button onClick={onAdd} style={btnPrimary}>
        <Plus size={16} /> Añadir primer evento
      </button>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', background: 'var(--teal)', color: '#0F0F1A',
  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
}

const btnSec: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer',
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5, fontWeight: 500,
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
