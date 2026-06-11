import React, { useState } from 'react'
import { Accessibility, X, Eye, Hand, Brain, Volume2, RotateCcw } from 'lucide-react'
import { useA11y, type A11yMode } from '../store/accessibility'

const MODES: { id: A11yMode; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'visual',    icon: Eye,      label: 'Visión reducida',   desc: 'Alto contraste + texto grande + lector de pantalla' },
  { id: 'motor',     icon: Hand,     label: 'Movilidad reducida', desc: 'Movimiento reducido + objetivos táctiles grandes' },
  { id: 'cognitive', icon: Brain,    label: 'Cognitiva',          desc: 'Interfaz simplificada + texto grande' },
  { id: 'deaf',      icon: Volume2,  label: 'Audición',           desc: 'Sin audio requerido + énfasis visual en alertas' },
]

export function AccessibilityPanel() {
  const [open, setOpen] = useState(false)
  const { highContrast, fontSize, reducedMotion, screenReaderHints, activeMode,
    toggleHighContrast, setFontSize, toggleReducedMotion, toggleScreenReaderHints,
    setMode, reset } = useA11y()

  return (
    <>
      {/* Trigger button — always visible, keyboard accessible */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Cerrar panel de accesibilidad' : 'Abrir panel de accesibilidad'}
        aria-expanded={open}
        aria-controls="a11y-panel"
        title="Opciones de accesibilidad"
        style={{
          position: 'fixed', bottom: 90, right: 20, zIndex: 9000,
          width: 44, height: 44, borderRadius: '50%',
          background: highContrast ? '#00FFEE' : 'var(--surface2)',
          border: '2px solid var(--border)',
          color: highContrast ? '#000' : 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,.4)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <Accessibility size={20} />
      </button>

      {/* Panel */}
      {open && (
        <div
          id="a11y-panel"
          role="dialog"
          aria-label="Panel de accesibilidad"
          aria-modal="false"
          style={{
            position: 'fixed', bottom: 144, right: 20, zIndex: 9000,
            width: 320, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
            padding: 20, fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Accessibility size={16} style={{ color: 'var(--teal)' }} />
              Accesibilidad
            </h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel de accesibilidad"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 6 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Perfiles rápidos */}
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
            <legend style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 600 }}>
              Perfil rápido
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MODES.map(m => {
                const Icon = m.icon
                const active = activeMode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(active ? 'none' : m.id)}
                    aria-pressed={active}
                    title={m.desc}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                      background: active ? 'rgba(78,205,196,0.15)' : 'var(--bg)',
                      border: active ? '1.5px solid var(--teal)' : '1.5px solid var(--border)',
                      color: active ? 'var(--teal)' : 'var(--muted)',
                      fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={18} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Controles individuales */}
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', margin: '0 0 12px' }}>
            <legend style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 6px', fontWeight: 600 }}>
              Ajustes individuales
            </legend>

            {/* Alto contraste */}
            <Toggle
              id="a11y-hc"
              label="Alto contraste"
              checked={highContrast}
              onChange={toggleHighContrast}
            />

            {/* Tamaño de texto */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }} id="a11y-font-label">Tamaño de texto</span>
              <div role="group" aria-labelledby="a11y-font-label" style={{ display: 'flex', gap: 4 }}>
                {(['normal', 'large', 'xlarge'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    aria-pressed={fontSize === s}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                      background: fontSize === s ? 'var(--teal)' : 'var(--bg)',
                      color: fontSize === s ? '#000' : 'var(--muted)',
                      fontSize: s === 'normal' ? 11 : s === 'large' ? 13 : 15,
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            {/* Movimiento reducido */}
            <Toggle
              id="a11y-rm"
              label="Reducir movimiento"
              checked={reducedMotion}
              onChange={toggleReducedMotion}
              style={{ marginTop: 12 }}
            />

            {/* Pistas para lector */}
            <Toggle
              id="a11y-sr"
              label="Pistas para lector de pantalla"
              checked={screenReaderHints}
              onChange={toggleScreenReaderHints}
              style={{ marginTop: 12 }}
            />
          </fieldset>

          {/* Reset + link declaración */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={reset}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 12, cursor: 'pointer', padding: 0,
              }}
            >
              <RotateCcw size={12} />
              Restablecer
            </button>
            <a
              href="/accesibilidad"
              style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'underline' }}
            >
              Declaración de accesibilidad →
            </a>
          </div>
        </div>
      )}
    </>
  )
}

function Toggle({
  id, label, checked, onChange, style,
}: {
  id: string; label: string; checked: boolean; onChange: () => void; style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...style }}>
      <label htmlFor={id} style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
        {label}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none',
          background: checked ? 'var(--teal)' : 'var(--border)',
          cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 3, left: checked ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff', transition: 'left 0.15s',
          }}
        />
        <span className="sr-only">{checked ? 'activado' : 'desactivado'}</span>
      </button>
    </div>
  )
}
