import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'

// ── Helpers de voz ─────────────────────────────────────────────────────
function getToken(): string | null {
  const st = sessionStorage.getItem('st')
  if (st) return st
  try {
    const stored = localStorage.getItem('stoqly-auth')
    if (stored) return JSON.parse(stored)?.state?.accessToken ?? null
  } catch {}
  return null
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/v1'

// AudioContext compartido — se desbloquea con el primer gesto del usuario
let sharedAudioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext()
  return sharedAudioCtx
}
function unlockAudio() {
  const ctx = getAudioCtx()
  if (ctx.state === 'suspended') ctx.resume()
}

function speakFallback(text: string) {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'es-ES'
  utt.rate = 1
  utt.pitch = 1
  synth.speak(utt)
}

async function speakText(text: string): Promise<void> {
  const token = getToken()
  try {
    const res = await fetch(`${API_BASE}/stoqly/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.warn('[Stoqly TTS] ElevenLabs error', res.status, '— usando voz del navegador')
      speakFallback(text)
      return
    }
    const arrayBuffer = await res.arrayBuffer()
    const ctx = getAudioCtx()
    await ctx.resume()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.start(0)
  } catch (err) {
    console.warn('[Stoqly TTS] fallo AudioContext:', err, '— usando voz del navegador')
    speakFallback(text)
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  actions?: Action[]
}

interface Action {
  label: string
  type: string
  payload?: any
}

export function StoqlyWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const qc = useQueryClient()
  const user = useAuth(s => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [listening, setListening] = useState(false)
  const [wakeActive, setWakeActive] = useState(false)
  const wakeRef = useRef<any>(null)

  // Scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Foco al abrir
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // ── Wake word — se activa manualmente con el botón 🟢 ─────────────────
  function toggleWakeWord() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return alert('Tu navegador no soporta reconocimiento de voz')

    unlockAudio() // desbloquear audio en el mismo gesto

    if (wakeActive) {
      wakeRef.current?.stop()
      setWakeActive(false)
      return
    }

    const wakeName = (user?.assistantName ?? 'Stoqly').toLowerCase()
    let keepGoing = true

    function startWakeLoop() {
      if (!keepGoing) return
      const r = new SR()
      wakeRef.current = r
      r.lang = 'es-ES'
      r.continuous = false
      r.interimResults = false

      r.onresult = (e: any) => {
        const text: string = e.results[0][0].transcript.toLowerCase()
        const detected = (text.includes('hola') && text.includes(wakeName)) || text.trim() === wakeName
        if (detected) {
          keepGoing = false
          setWakeActive(false)
          setOpen(true)
          setTimeout(() => startCommandListening(), 400)
        }
      }
      r.onend = () => { if (keepGoing) setTimeout(startWakeLoop, 200) }
      r.onerror = () => { if (keepGoing) setTimeout(startWakeLoop, 800) }
      r.start()
    }

    function startCommandListening() {
      const cmd = new SR()
      recognitionRef.current = cmd
      cmd.lang = 'es-ES'
      cmd.continuous = false
      cmd.interimResults = false
      setListening(true)
      cmd.onresult = (ev: any) => {
        const transcript = ev.results[0][0].transcript
        setListening(false)
        const userMsg: Message = { role: 'user', content: transcript, timestamp: new Date().toISOString() }
        setMessages(prev => {
          const newHistory = [...prev, userMsg]
          sendMessageWithText(transcript, newHistory)
          return newHistory
        })
      }
      cmd.onerror = () => setListening(false)
      cmd.onend = () => setListening(false)
      cmd.start()
    }

    startWakeLoop()
    setWakeActive(true)
  }

  // Mensaje de bienvenida
  useEffect(() => {
    if (user && messages.length === 0) {
      const hour = new Date().getHours()
      const saludo = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
      const nombre = user.assistantName ?? 'Stoqly'
      setMessages([{
        role: 'assistant',
        content: `${saludo}, ${user.name?.split(' ')[0]}. Soy ${nombre}. Dime qué necesitas — puedo ayudarte con tu despensa, la lista de la compra o sugerirte qué cocinar con lo que tienes en casa.`,
        timestamp: new Date().toISOString()
      }])
    }
  }, [user])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    unlockAudio()
    const text = input.trim()
    setInput('')

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setLoading(true)

    try {
      const res = await api.post<{ reply: string; actions?: Action[] }>('/stoqly/chat', {
        message: text,
        currentPage: location.pathname,
        history: newHistory.slice(-10).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }))
      })

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
        actions: res.actions?.length ? res.actions : undefined
      }
      setMessages(prev => [...prev, assistantMsg])

      // TTS — reproducir respuesta si la voz está activada
      if (voiceEnabled && res.reply) {
        speakText(res.reply).catch(() => {})
      }

      if (!open) setUnread(u => u + 1)

      // Ejecutar acciones del frontend
      if (res.actions?.length) {
        for (const action of res.actions) {
          if (action.type === 'navigate_to' && action.payload?.route) {
            setTimeout(() => {
              setOpen(false)
              navigate(action.payload.route)
            }, 800)
          }
        }
        qc.invalidateQueries({ queryKey: ['items'] })
        qc.invalidateQueries({ queryKey: ['summary'] })
        qc.invalidateQueries({ queryKey: ['shopping'] })
      }
    } catch (err: any) {
      console.error('Stoqly error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err?.message ?? 'desconocido'}`,
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  function toggleMic() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return alert('Tu navegador no soporta reconocimiento de voz')

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    unlockAudio()
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'es-ES'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
      // Auto-enviar tras 300ms
      setTimeout(() => {
        setInput('')
        const userMsg: Message = { role: 'user', content: transcript, timestamp: new Date().toISOString() }
        setMessages(prev => {
          const newHistory = [...prev, userMsg]
          // Disparar envío
          sendMessageWithText(transcript, newHistory)
          return newHistory
        })
      }, 300)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
  }

  async function sendMessageWithText(text: string, history: Message[]) {
    setLoading(true)
    try {
      const res = await api.post<{ reply: string; actions?: Action[] }>('/stoqly/chat', {
        message: text,
        currentPage: location.pathname,
        history: history.slice(-10).map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }))
      })
      const assistantMsg: Message = {
        role: 'assistant', content: res.reply,
        timestamp: new Date().toISOString(),
        actions: res.actions?.length ? res.actions : undefined
      }
      setMessages(prev => [...prev, assistantMsg])
      if (voiceEnabled && res.reply) speakText(res.reply).catch(() => {})
      if (!open) setUnread(u => u + 1)
      if (res.actions?.length) {
        for (const action of res.actions) {
          if (action.type === 'navigate_to' && action.payload?.route) {
            setTimeout(() => { setOpen(false); navigate(action.payload.route) }, 800)
          }
        }
        qc.invalidateQueries({ queryKey: ['items'] })
        qc.invalidateQueries({ queryKey: ['summary'] })
        qc.invalidateQueries({ queryKey: ['shopping'] })
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err?.message ?? 'desconocido'}`, timestamp: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    '¿Qué hay en mi despensa?',
    '¿Qué puedo cenar?',
    '¿Qué caduca pronto?',
    'Quiero añadir un segundo domicilio',
    '¿Cuál es mi plan y qué incluye?',
    'Cómo escaneo productos',
  ]

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(78,205,196,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(78,205,196,0); }
        }
      `}</style>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? '#0F6E56' : '#1D9E75',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(29,158,117,0.4)',
          transition: 'all 0.2s',
          fontSize: 22,
        }}
        title={wakeActive && !open ? 'Di "Stoqly" para activar' : 'Hablar con Stoqly'}
      >
        {open ? '✕' : '✦'}
        {/* Punto verde cuando wake word activo */}
        {wakeActive && !open && (
          <span style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 9, height: 9, borderRadius: '50%',
            background: '#1D9E75', border: '2px solid #0F1923',
          }} />
        )}
        {unread > 0 && !open && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#E24B4A', color: '#fff',
            borderRadius: '50%', width: 20, height: 20,
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread}
          </span>
        )}
      </button>

      {/* Panel del chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 999,
          width: 380, height: 520,
          background: '#1A1A2E', border: '1px solid #2A2A3E',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', background: '#0F0F1A',
            borderBottom: '1px solid #2A2A3E',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#1D9E75', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16, flexShrink: 0,
            }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F5' }}>
                {user?.assistantName ?? 'Stoqly'}
              </div>
              <div style={{ fontSize: 11, color: '#4ECDC4' }}>
                {loading ? 'Pensando...' : listening ? 'Escuchando...' : 'Listo para ayudarte'}
              </div>
            </div>
            {/* Botón wake word */}
            <button
              onClick={toggleWakeWord}
              title={wakeActive ? 'Desactivar escucha de voz' : `Activar escucha ("Hola ${user?.assistantName ?? 'Stoqly'}")`}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: wakeActive ? 'rgba(78,205,196,0.2)' : '#2A2A3E',
                border: `1px solid ${wakeActive ? '#4ECDC4' : '#3A3A4E'}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
                animation: wakeActive ? 'pulse 2s infinite' : 'none',
              }}
            >
              {wakeActive ? '🟢' : '🎤'}
            </button>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#1D9E75' : '#22223B',
                  color: msg.role === 'user' ? '#fff' : '#E0E0F0',
                  fontSize: 13, lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
                {/* Acciones ejecutadas */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {msg.actions.map((a, j) => (
                      <span key={j} style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(78,205,196,0.15)', color: '#4ECDC4',
                        border: '1px solid rgba(78,205,196,0.3)',
                      }}>
                        ✓ {a.type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{
                  padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                  background: '#22223B', color: '#888', fontSize: 20, letterSpacing: 4,
                }}>
                  ···
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions — solo si no hay historial */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {quickActions.map((qa, i) => (
                <button key={i} onClick={() => { setInput(qa); setTimeout(() => inputRef.current?.focus(), 50) }}
                  style={{
                    padding: '5px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                    background: 'rgba(78,205,196,0.08)', border: '1px solid rgba(78,205,196,0.25)',
                    color: '#4ECDC4',
                  }}>
                  {qa}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid #2A2A3E',
            display: 'flex', gap: 6, alignItems: 'center',
          }}>
            {/* Botón micrófono */}
            <button
              onClick={toggleMic}
              title={listening ? 'Parar' : 'Hablar'}
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: listening ? '#E24B4A' : '#2A2A3E',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, transition: 'background 0.15s',
                animation: listening ? 'pulse 1s infinite' : 'none',
              }}
            >
              🎙️
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={listening ? 'Escuchando...' : 'Escribe a Stoqly...'}
              style={{
                flex: 1, padding: '9px 12px', background: '#0F0F1A',
                border: `1px solid ${listening ? '#E24B4A' : '#2A2A3E'}`, borderRadius: 10,
                color: '#F0F0F5', fontSize: 13, outline: 'none', transition: 'border 0.15s',
              }}
            />

            {/* Botón altavoz (on/off TTS) */}
            <button
              onClick={() => setVoiceEnabled(v => !v)}
              title={voiceEnabled ? 'Silenciar voz' : 'Activar voz'}
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: voiceEnabled ? 'rgba(78,205,196,0.15)' : '#2A2A3E',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15,
              }}
            >
              {voiceEnabled ? '🔊' : '🔇'}
            </button>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: input.trim() && !loading ? '#1D9E75' : '#2A2A3E',
                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#fff', transition: 'background 0.15s',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
