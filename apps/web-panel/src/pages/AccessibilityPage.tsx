/**
 * AccessibilityPage — Declaración de accesibilidad (EAA / Real Decreto 193/2023)
 * Ruta pública: /accesibilidad
 * Cumple: WCAG 2.1 AA, Real Decreto 193/2023, Directiva UE 2019/882
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Clock, Mail, ExternalLink } from 'lucide-react'

const LAST_REVIEW = '2025-06-01'
const CONTACT_EMAIL = 'accesibilidad@stoqly.app'

export function AccessibilityPage() {
  return (
    <div
      style={{
        maxWidth: 760, margin: '0 auto', padding: '48px 24px',
        color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif',
        lineHeight: 1.7,
      }}
    >
      {/* Back */}
      <Link
        to="/"
        style={{ color: 'var(--teal)', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32 }}
      >
        ← Volver a inicio
      </Link>

      {/* Header */}
      <header>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', color: 'var(--teal)' }}>
          Declaración de accesibilidad
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, margin: 0 }}>
          Stoqly — Aplicación web de gestión del hogar<br />
          Última revisión: <time dateTime={LAST_REVIEW}>{formatDate(LAST_REVIEW)}</time>
        </p>
      </header>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />

      {/* Sección 1 — Compromiso */}
      <Section title="Compromiso con la accesibilidad">
        <p>
          Domtrace, S.L. se compromete a hacer que Stoqly sea accesible de conformidad con el{' '}
          <ExternalRef href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-5156">
            Real Decreto 193/2023
          </ExternalRef>{' '}
          (transposición española de la Directiva UE 2019/882 sobre los requisitos de accesibilidad de los productos
          y servicios — European Accessibility Act) y las{' '}
          <ExternalRef href="https://www.w3.org/TR/WCAG21/">
            Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1, nivel AA
          </ExternalRef>.
        </p>
        <p>
          La accesibilidad no es un añadido posterior en Stoqly: está integrada en el núcleo del diseño y del
          código desde el inicio, como elemento diferenciador central del producto.
        </p>
      </Section>

      {/* Sección 2 — Estado de conformidad */}
      <Section title="Estado de conformidad">
        <ConformanceBadge level="Parcialmente conforme" />
        <p style={{ marginTop: 16 }}>
          Stoqly es <strong>parcialmente conforme</strong> con las WCAG 2.1 nivel AA. Las no conformidades y
          las excepciones se detallan a continuación.
        </p>
      </Section>

      {/* Sección 3 — Áreas conformes */}
      <Section title="Áreas conformes">
        <p style={{ marginBottom: 16 }}>Los siguientes criterios WCAG 2.1 AA están implementados:</p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {COMPLIANT_AREAS.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <span style={{ fontSize: 14 }}>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Sección 4 — No conformidades */}
      <Section title="Contenido no accesible">
        <p style={{ marginBottom: 16 }}>
          El siguiente contenido no es todavía totalmente accesible por las razones que se indican:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {NON_COMPLIANT_AREAS.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <div style={{ fontSize: 14 }}>
                <strong>{item.title}</strong>
                <br />
                <span style={{ color: 'var(--muted)' }}>{item.reason}</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Sección 5 — Tecnologías de apoyo compatibles */}
      <Section title="Tecnologías de apoyo compatibles">
        <p>
          Stoqly ha sido desarrollado para ser compatible con las siguientes tecnologías de apoyo:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ASSISTIVE_TECH.map((t, i) => (
            <li key={i} style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--teal)', fontWeight: 700 }}>·</span> {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* Sección 6 — Funciones de accesibilidad integradas */}
      <Section title="Funciones de accesibilidad integradas">
        <p>
          Stoqly incluye un <strong>panel de accesibilidad propio</strong> (botón <kbd style={kbdStyle}>♿</kbd> en la
          esquina inferior derecha) con las siguientes opciones:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BUILTIN_FEATURES.map((f, i) => (
            <li key={i} style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--teal)', fontWeight: 700 }}>·</span> {f}
            </li>
          ))}
        </ul>
      </Section>

      {/* Sección 7 — Navegación por teclado */}
      <Section title="Navegación por teclado">
        <p>La aplicación es completamente operable con teclado:</p>
        <table
          aria-label="Atajos de teclado"
          style={{
            width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8,
          }}
        >
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={thStyle}>Tecla</th>
              <th style={thStyle}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {KEYBOARD_SHORTCUTS.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                <td style={tdStyle}><kbd style={kbdStyle}>{row.key}</kbd></td>
                <td style={tdStyle}>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Sección 8 — Contacto y retroalimentación */}
      <Section title="Contacto y notificación de problemas">
        <p>
          Si encuentras un problema de accesibilidad o necesitas contenido en un formato alternativo,
          puedes contactar con nosotros por los siguientes medios. Nos comprometemos a responder
          en un plazo máximo de <strong>15 días hábiles</strong>.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            aria-label={`Enviar correo electrónico a ${CONTACT_EMAIL}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--teal)', color: '#000', fontWeight: 700,
              padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 14,
            }}
          >
            <Mail size={16} aria-hidden="true" />
            {CONTACT_EMAIL}
          </a>
        </div>
        <p style={{ marginTop: 16, fontSize: 14, color: 'var(--muted)' }}>
          En tu mensaje indica: descripción del problema, página o sección donde ocurre, tecnología
          de apoyo que utilizas (si aplica) y sistema operativo / navegador.
        </p>
      </Section>

      {/* Sección 9 — Procedimiento de reclamación */}
      <Section title="Procedimiento de reclamación">
        <p>
          Si no recibes una respuesta satisfactoria a tu notificación, puedes presentar una reclamación
          ante la autoridad competente. En España, el órgano de supervisión es el{' '}
          <ExternalRef href="https://administracion.gob.es/pagFront/atencionCiudadana/atencionPresencial/contactarAdministracion.htm">
            Centro de Referencia de Autonomía Personal y Ayudas Técnicas (CEAPAT)
          </ExternalRef>{' '}
          dependiente del IMSERSO, o el Defensor del Pueblo.
        </p>
      </Section>

      {/* Sección 10 — Plan de mejora */}
      <Section title="Plan de mejora continua">
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ROADMAP.map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Clock size={16} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
              <div style={{ fontSize: 14 }}>
                <strong>{item.quarter}</strong> — {item.task}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Footer */}
      <footer style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
        <p>
          Esta declaración fue preparada el <time dateTime="2025-06-01">1 de junio de 2025</time> y revisada por
          última vez el <time dateTime={LAST_REVIEW}>{formatDate(LAST_REVIEW)}</time>.
          El método de preparación utilizado fue <strong>autoevaluación</strong> realizada por el equipo
          de desarrollo de Domtrace, S.L.
        </p>
        <p>
          <strong>Domtrace, S.L.</strong> · {CONTACT_EMAIL}
        </p>
      </footer>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title.replace(/\s+/g, '-')} style={{ marginBottom: 40 }}>
      <h2
        id={title.replace(/\s+/g, '-')}
        style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function ExternalRef({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{ color: 'var(--teal)', textDecoration: 'underline' }}
    >
      {children}
      <ExternalLink size={12} style={{ display: 'inline', marginLeft: 3, verticalAlign: 'middle' }} aria-label="(abre en nueva pestaña)" />
    </a>
  )
}

function ConformanceBadge({ level }: { level: string }) {
  return (
    <div
      role="status"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,209,102,0.1)', border: '1px solid var(--warning)',
        borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 600, color: 'var(--warning)',
      }}
    >
      <AlertCircle size={16} aria-hidden="true" />
      {level} con WCAG 2.1 AA
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px', borderBottom: '1px solid var(--border)',
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '2px 7px', fontFamily: 'monospace',
  fontSize: 12, color: 'var(--text)',
}

// ── Datos ─────────────────────────────────────────────────────────────────────

const COMPLIANT_AREAS = [
  'Criterio 1.1.1 — Contenido no textual: todos los iconos llevan aria-hidden="true" y los botones icónicos tienen aria-label descriptivo.',
  'Criterio 1.3.1 — Información y relaciones: uso de roles ARIA semánticos (navigation, main, dialog, status, switch, listbox, option).',
  'Criterio 1.3.3 — Características sensoriales: las instrucciones no dependen únicamente de color o forma.',
  'Criterio 1.4.3 — Contraste (mínimo): modo estándar ≥ 4.5:1; modo alto contraste ≥ 7:1.',
  'Criterio 1.4.4 — Cambio de tamaño del texto: escalado hasta 200% sin pérdida de contenido.',
  'Criterio 2.1.1 — Teclado: toda la funcionalidad es operable con teclado; sin trampas de teclado.',
  'Criterio 2.1.2 — Sin trampas de teclado: la tecla Escape cierra todos los diálogos y devuelve el foco al elemento activador.',
  'Criterio 2.4.1 — Saltar bloques: enlace "Saltar al contenido principal" como primer elemento enfocable.',
  'Criterio 2.4.2 — Página con título: cada ruta actualiza document.title; los cambios de ruta se anuncian al lector de pantalla.',
  'Criterio 2.4.3 — Orden de foco: el orden del DOM coincide con el orden visual; los diálogos reciben foco al abrirse.',
  'Criterio 2.4.7 — Visible al enfocar: anillo de foco de alta visibilidad (3px, --focus-ring) en todos los elementos interactivos.',
  'Criterio 3.1.1 — Idioma de la página: atributo lang="es" en el elemento html.',
  'Criterio 3.3.1 — Identificación de errores: los errores de formulario se anuncian mediante aria-live.',
  'Criterio 4.1.2 — Nombre, función, valor: todos los controles tienen nombre accesible, rol y estado correctos.',
  'Criterio 4.1.3 — Mensajes de estado: las notificaciones y cambios de estado se exponen vía aria-live="polite".',
]

const NON_COMPLIANT_AREAS = [
  {
    title: 'Criterio 1.4.10 — Reajuste (Reflow)',
    reason: 'La barra lateral a 220px puede solapar contenido en viewports muy estrechos (<320px). Previsto: rediseño responsivo en Q3 2025.',
  },
  {
    title: 'Criterio 1.4.11 — Contraste de componentes no textuales',
    reason: 'Algunos iconos decorativos en el tema oscuro estándar presentan contraste de borde insuficiente (< 3:1). En modo alto contraste este problema no existe. Previsto: Q3 2025.',
  },
  {
    title: 'Criterio 2.5.3 — Etiqueta en nombre',
    reason: 'Ciertos botones generados dinámicamente por el asistente de IA pueden carecer de etiqueta visible que coincida con el nombre accesible. Se revisa continuamente.',
  },
]

const ASSISTIVE_TECH = [
  'NVDA (Windows) con Firefox y Chrome — lecturas de pantalla, anuncios de estado y cambios de ruta',
  'JAWS (Windows) con Chrome',
  'VoiceOver (macOS/iOS) con Safari',
  'TalkBack (Android) con Chrome',
  'Navegación completa por teclado (Tab, Shift+Tab, Enter, Espacio, Escape, flechas)',
  'Zoom de navegador hasta 200% sin pérdida de funcionalidad',
  'Modo de movimiento reducido del sistema operativo (prefers-reduced-motion)',
]

const BUILTIN_FEATURES = [
  'Alto contraste — esquema de color negro/blanco/amarillo con ratio ≥ 7:1.',
  'Texto grande — ampliación al 112,5% (grande) o 131,25% (muy grande) aplicada globalmente.',
  'Movimiento reducido — desactiva transiciones y animaciones en toda la aplicación.',
  'Pistas para lector de pantalla — añade descripciones adicionales en los mensajes del asistente.',
  'Perfiles de discapacidad rápidos — Visión reducida, Movilidad reducida, Cognitiva y Audición.',
  'Preferencias persistentes — guardadas en el dispositivo; se aplican automáticamente en cada visita.',
  'Respeta prefers-reduced-motion y prefers-color-scheme del sistema operativo.',
]

const KEYBOARD_SHORTCUTS = [
  { key: 'Tab',        action: 'Mover el foco al siguiente elemento interactivo' },
  { key: 'Shift+Tab', action: 'Mover el foco al elemento interactivo anterior' },
  { key: 'Enter',      action: 'Activar enlace o botón con foco' },
  { key: 'Espacio',    action: 'Activar botón, casilla o interruptor con foco' },
  { key: 'Escape',     action: 'Cerrar diálogo o menú desplegable y devolver foco' },
  { key: '↑ ↓',        action: 'Navegar entre opciones de una lista o menú' },
]

const ROADMAP = [
  { quarter: 'Q3 2025', task: 'Reajuste responsivo de la barra lateral para viewports < 320px (criterio 1.4.10).' },
  { quarter: 'Q3 2025', task: 'Mejorar contraste de bordes en iconos no textuales a ≥ 3:1 (criterio 1.4.11).' },
  { quarter: 'Q4 2025', task: 'Auditoría externa de accesibilidad por tercero certificado (WCAG 2.1 AA).' },
  { quarter: 'Q1 2026', task: 'Compatibilidad con WCAG 2.2 (criterios nuevos: 2.4.11, 2.4.12, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8).' },
]
