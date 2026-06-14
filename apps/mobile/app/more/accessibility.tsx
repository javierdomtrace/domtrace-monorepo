import { View, Text, TouchableOpacity, ScrollView, Linking, StyleSheet } from 'react-native'
import { theme } from '@/theme'
import { ScreenHeader, Section, styles as ui } from '@/components/ui'

const LAST_REVIEW = '2025-06-01'
const CONTACT_EMAIL = 'accesibilidad@stoqly.app'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

const COMPLIANT_AREAS = [
  'Criterio 1.1.1 — Contenido no textual: todos los iconos llevan etiquetas accesibles y los botones icónicos tienen descripción.',
  'Criterio 1.3.1 — Información y relaciones: uso de roles de accesibilidad nativos (encabezados, botones, campos, interruptores).',
  'Criterio 1.3.3 — Características sensoriales: las instrucciones no dependen únicamente de color o forma.',
  'Criterio 1.4.3 — Contraste (mínimo): modo estándar ≥ 4.5:1; modo alto contraste ≥ 7:1.',
  'Criterio 1.4.4 — Cambio de tamaño del texto: la app respeta el tamaño de letra del sistema hasta 200%.',
  'Criterio 2.1.1 — Sin trampas de navegación: toda la funcionalidad es accesible mediante gestos estándar y lector de pantalla.',
  'Criterio 2.4.2 — Pantalla con título: cada pantalla tiene un título identificable.',
  'Criterio 2.4.3 — Orden de foco: el orden de lectura coincide con el orden visual.',
  'Criterio 3.1.1 — Idioma: la app está disponible en español (es).',
  'Criterio 3.3.1 — Identificación de errores: los errores de formulario se anuncian al lector de pantalla.',
  'Criterio 4.1.2 — Nombre, función, valor: todos los controles tienen nombre, rol y estado accesibles correctos.',
  'Criterio 4.1.3 — Mensajes de estado: las notificaciones y cambios de estado se anuncian de forma no intrusiva.',
]

const NON_COMPLIANT_AREAS = [
  {
    title: 'Criterio 1.4.10 — Reajuste (Reflow)',
    reason: 'Algunas pantallas con tablas o paneles complejos pueden requerir desplazamiento horizontal en dispositivos muy estrechos. Previsto: rediseño responsivo en Q3 2025.',
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
  'VoiceOver (iOS) — lecturas de pantalla, anuncios de estado y cambios de pantalla',
  'TalkBack (Android) — lecturas de pantalla, anuncios de estado y cambios de pantalla',
  'Navegación ampliada y gestos de accesibilidad del sistema operativo',
  'Zoom y tamaño de letra del sistema hasta 200% sin pérdida de funcionalidad',
  'Modo de movimiento reducido del sistema operativo (reduce motion)',
]

const BUILTIN_FEATURES = [
  'Alto contraste — esquema de color con ratio ≥ 7:1.',
  'Texto grande — ampliación de tipografía aplicada globalmente.',
  'Movimiento reducido — desactiva transiciones y animaciones en toda la app.',
  'Pistas para lector de pantalla — añade descripciones adicionales en los mensajes del asistente.',
  'Perfiles de discapacidad rápidos — Visión reducida, Movilidad reducida, Cognitiva y Audición.',
  'Preferencias persistentes — guardadas en el dispositivo; se aplican automáticamente en cada visita.',
  'Respeta las preferencias de accesibilidad del sistema operativo (movimiento reducido, tamaño de texto, contraste).',
]

const ROADMAP = [
  { quarter: 'Q3 2025', task: 'Rediseño responsivo de pantallas con tablas o paneles complejos (criterio 1.4.10).' },
  { quarter: 'Q3 2025', task: 'Mejorar contraste de bordes en iconos no textuales a ≥ 3:1 (criterio 1.4.11).' },
  { quarter: 'Q4 2025', task: 'Auditoría externa de accesibilidad por tercero certificado (WCAG 2.1 AA).' },
  { quarter: 'Q1 2026', task: 'Compatibilidad con WCAG 2.2 (criterios nuevos: 2.4.11, 2.4.12, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8).' },
]

function Bullet({ children, icon }: { children: string; icon?: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletIcon}>{icon ?? '·'}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

export default function AccessibilityScreen() {
  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScreenHeader title="Declaración de accesibilidad" subtitle={`Stoqly · Última revisión: ${formatDate(LAST_REVIEW)}`} />

        <Section title="Compromiso con la accesibilidad">
          <Text style={styles.p}>
            Domtrace, S.L. se compromete a hacer que Stoqly sea accesible de conformidad con el Real Decreto 193/2023
            (transposición española de la Directiva UE 2019/882 sobre los requisitos de accesibilidad de los productos
            y servicios — European Accessibility Act) y las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.1, nivel AA.
          </Text>
          <Text style={styles.p}>
            La accesibilidad no es un añadido posterior en Stoqly: está integrada en el núcleo del diseño y del
            código desde el inicio, como elemento diferenciador central del producto.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-5156')}>
            <Text style={styles.link}>Ver Real Decreto 193/2023 ↗</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.w3.org/TR/WCAG21/')}>
            <Text style={styles.link}>Ver WCAG 2.1 ↗</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Estado de conformidad">
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚠ Parcialmente conforme con WCAG 2.1 AA</Text>
          </View>
          <Text style={[styles.p, { marginTop: 12 }]}>
            Stoqly es parcialmente conforme con las WCAG 2.1 nivel AA. Las no conformidades y las excepciones se
            detallan a continuación.
          </Text>
        </Section>

        <Section title="Áreas conformes">
          <Text style={styles.p}>Los siguientes criterios WCAG 2.1 AA están implementados:</Text>
          {COMPLIANT_AREAS.map((item, i) => <Bullet key={i} icon="✅">{item}</Bullet>)}
        </Section>

        <Section title="Contenido no accesible">
          <Text style={styles.p}>El siguiente contenido no es todavía totalmente accesible por las razones que se indican:</Text>
          {NON_COMPLIANT_AREAS.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bulletTitle}>{item.title}</Text>
                <Text style={styles.bulletSub}>{item.reason}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Tecnologías de apoyo compatibles">
          <Text style={styles.p}>Stoqly ha sido desarrollado para ser compatible con las siguientes tecnologías de apoyo:</Text>
          {ASSISTIVE_TECH.map((t, i) => <Bullet key={i}>{t}</Bullet>)}
        </Section>

        <Section title="Funciones de accesibilidad integradas">
          <Text style={styles.p}>
            Stoqly incluye un panel de accesibilidad propio (en Ajustes ♿) con las siguientes opciones:
          </Text>
          {BUILTIN_FEATURES.map((f, i) => <Bullet key={i}>{f}</Bullet>)}
        </Section>

        <Section title="Contacto y notificación de problemas">
          <Text style={styles.p}>
            Si encuentras un problema de accesibilidad o necesitas contenido en un formato alternativo,
            puedes contactar con nosotros. Nos comprometemos a responder en un plazo máximo de 15 días hábiles.
          </Text>
          <TouchableOpacity style={styles.mailBtn} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
            <Text style={styles.mailBtnText}>✉️ {CONTACT_EMAIL}</Text>
          </TouchableOpacity>
          <Text style={[styles.p, { marginTop: 12, color: theme.muted, fontSize: 13 }]}>
            En tu mensaje indica: descripción del problema, pantalla donde ocurre, tecnología de apoyo que utilizas
            (si aplica) y sistema operativo / versión de la app.
          </Text>
        </Section>

        <Section title="Procedimiento de reclamación">
          <Text style={styles.p}>
            Si no recibes una respuesta satisfactoria a tu notificación, puedes presentar una reclamación ante la
            autoridad competente. En España, el órgano de supervisión es el Centro de Referencia de Autonomía
            Personal y Ayudas Técnicas (CEAPAT), dependiente del IMSERSO, o el Defensor del Pueblo.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://administracion.gob.es/pagFront/atencionCiudadana/atencionPresencial/contactarAdministracion.htm')}>
            <Text style={styles.link}>Ver información de contacto con la administración ↗</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Plan de mejora continua">
          {ROADMAP.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletIcon}>🕐</Text>
              <Text style={styles.bulletText}><Text style={{ fontWeight: '800' }}>{item.quarter}</Text> — {item.task}</Text>
            </View>
          ))}
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Esta declaración fue preparada el 1 de junio de 2025 y revisada por última vez el {formatDate(LAST_REVIEW)}.
            El método de preparación utilizado fue autoevaluación realizada por el equipo de desarrollo de Domtrace, S.L.
          </Text>
          <Text style={[styles.footerText, { fontWeight: '800', marginTop: 8 }]}>Domtrace, S.L. · {CONTACT_EMAIL}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  p: { color: theme.text, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  link: { color: theme.teal, fontSize: 13, textDecorationLine: 'underline', marginBottom: 6 },

  badge: { alignSelf: 'flex-start', backgroundColor: theme.warn + '22', borderWidth: 1, borderColor: theme.warn, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: theme.warn, fontSize: 13, fontWeight: '700' },

  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  bulletIcon: { fontSize: 14, marginTop: 1 },
  bulletText: { flex: 1, color: theme.text, fontSize: 13, lineHeight: 19 },
  bulletTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  bulletSub: { color: theme.muted, fontSize: 12, marginTop: 2, lineHeight: 18 },

  mailBtn: { backgroundColor: theme.teal, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignSelf: 'flex-start', marginTop: 8 },
  mailBtnText: { color: '#0F0F1A', fontWeight: '800', fontSize: 14 },

  footer: { marginHorizontal: 20, marginTop: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border },
  footerText: { color: theme.muted, fontSize: 12, lineHeight: 18 },
})
