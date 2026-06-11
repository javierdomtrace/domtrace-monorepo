import type { FastifyPluginAsync } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@domtrace/db'
import type { StoqlyContext, StoqlyAction, ChatMessage } from '@domtrace/types'
import { getActiveHousehold } from '../lib/household.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── System prompt de Stoqly ──────────────────────────────────────────
// ── Tipos extendidos ──────────────────────────────────────────────────
interface ConsumptionPattern {
  name: string
  avgDaysBetweenBuys: number  // cada cuántos días suelen comprarlo
  daysSinceLastSeen: number   // hace cuántos días desapareció de la despensa
  timesConsumed: number       // veces que se ha consumido
  likelyRunningOut: boolean   // si es probable que lo necesiten ya
}

interface ExtendedStoqlyCtx extends StoqlyContext {
  householdMembers?: Array<{name: string; allergens: string[]}>
  subscriptionTier?: string
  households?: Array<{name: string; isActive: boolean}>
  currentPage?: string
  pendingDonations?: Array<{id: string; name: string; quantity: number; unit: string}>
  consumptionPatterns?: ConsumptionPattern[]
  nutritionalProfile?: {
    kcalDiarias: number
    protDiarias: number
    objetivo: string
  } | null
  shoppingList?: Array<{id: string; name: string; quantity: number; unit: string; addedBy: string}>
  sportProfile?: {
    deporte: string
    deporteNivel?: string | null
    deporteDiasSemana?: number | null
  } | null
  activeSupplements?: Array<{name: string; quantity: number; unit: string; dosisDesc?: string | null; frecuenciaToma?: string | null; lowStock: boolean}>
  activeMedications?: Array<{name: string; quantity: number; unit: string; dosisDesc?: string | null; frecuenciaToma?: string | null; daysUntilExpiry?: number | null; lowStock: boolean; expiringSoon: boolean; expired: boolean}>
  babies?: Array<{
    name: string
    ageMonths: number
    gender?: string | null
    lastFeeding?: { type: string; minutesAgo: number } | null
    feedingsToday: number
    latestWeight?: number | null
    latestHeight?: number | null
  }>
}

function buildSystemPrompt(ctx: ExtendedStoqlyCtx): string {
  const humor = ctx.humorEnabled && ctx.accessibilityMode === 'VOICE'
    ? 'Puedes usar un toque de humor ligero y situacional — máximo una vez por conversación. Nunca fuerces el chiste. Si el usuario responde seco, baja el tono.'
    : 'Mantén un tono cálido y amigable, sin humor.'

  const membersInfo = ctx.householdMembers && ctx.householdMembers.length > 1
    ? ctx.householdMembers.map(m =>
        `- ${m.name}: ${m.allergens.length > 0 ? m.allergens.join(', ') : 'sin alergias'}`
      ).join('\n')
    : null

  const PLAN_LIMITS: Record<string, string> = {
    FREE:       '1 domicilio, hasta 5 personas',
    HOGAR:      '1 domicilio, hasta 5 personas',
    EXPERTO:    'hasta 3 domicilios, hasta 10 personas, historial de consumo, módulo cosméticos y medicamentos',
    PREMIUM:    'hasta 5 domicilios, personas ilimitadas, estadísticas de ahorro, alertas sanitarias AESAN, IA avanzada',
    ENTERPRISE: 'sin límites, gestión empresarial',
  }

  const tier = ctx.subscriptionTier ?? 'FREE'
  const householdsList = ctx.households?.map(h => `- ${h.name}${h.isActive ? ' (activo)' : ''}`).join('\n') ?? ''

  return `Eres ${ctx.assistantName}, el asistente personal de despensa de ${ctx.userName}.

PERSONALIDAD:
- Eres un amigo que ayuda, no un asistente que informa.
- Tuteas siempre. Eres cálido, cercano y directo.
- Tus respuestas son cortas: máximo 2 frases, salvo en recetas o listas.
- Siempre terminas con una acción posible o una pregunta. Nunca con una afirmación cerrada.
- Nunca usas jerga técnica. No existe "sincronizar", "base de datos" ni "actualizar inventario".
- ${humor}

CONTEXTO DEL HOGAR:
- Usuario: ${ctx.userName}
- Personas en casa: ${ctx.householdMembers?.length ?? 1} ${(ctx.householdMembers?.length ?? 1) === 1 ? '(vive solo/a — ajusta cantidades a una persona)' : 'personas'}
- Tus alergias: ${ctx.allergens.length > 0 ? ctx.allergens.join(', ') : 'ninguna'}
- Supermercado preferido: ${ctx.supermarket ?? 'no configurado'}
- Accesibilidad: ${ctx.accessibilityMode}
${membersInfo ? `\nPERSONAS EN CASA Y SUS ALERGIAS:\n${membersInfo}\nIMPORTANTE: Cuando sugieras recetas o añadas productos a la lista de compra, ten en cuenta las alergias de TODAS las personas. Si alguien es celiaco, no incluyas gluten. Si alguien es intolerante a la lactosa, sugiere la alternativa sin lactosa. Si preguntan para quién cocinas, pregunta antes de sugerir.` : ''}
${(ctx.householdMembers?.length ?? 1) === 1 ? '\nCANTIDADES PARA UNA PERSONA: Cuando sugieras qué comprar o cuánto de algo, ajústalo siempre a una persona. Fruta: 3-4 piezas máximo. Verdura: poca cantidad fresca. Nunca packs familiares ni cantidades que no se puedan consumir antes de que se estropeen.' : ''}

DESPENSA ACTUAL (${ctx.pantry.length} productos):
${ctx.pantry.map(i => {
  const base = `- ${i.name}: ${i.quantity}${i.unit}`
  if ((i as any).tipoFresco && (i as any).fechaCompra) {
    const diasDesdeCompra = Math.floor((Date.now() - new Date((i as any).fechaCompra).getTime()) / 86400000)
    const vidaUtil = (i as any).vidaUtilDias ?? 7
    const diasRestantes = Math.max(0, vidaUtil - diasDesdeCompra)
    const pct = Math.round((diasDesdeCompra / vidaUtil) * 100)
    const estado = pct >= 100 ? '⚠️ USAR YA' : pct >= 80 ? '⏰ usar pronto' : '✅ fresco'
    return `${base} [FRESCO: ${diasDesdeCompra} días desde compra, ${diasRestantes} días restantes ${estado}]`
  }
  return `${base}${i.expiryDate ? `, caduca ${i.daysUntilExpiry !== undefined ? `en ${i.daysUntilExpiry} días` : i.expiryDate}` : ''}`
}).join('\n')}

PRÓXIMOS A CADUCAR:
${ctx.expiringSoon.length > 0
  ? ctx.expiringSoon.map(i => `- ${i.name}: ${i.daysUntilExpiry} días`).join('\n')
  : '- Ninguno urgente ahora mismo'}

SUSCRIPCIÓN Y DOMICILIOS:
- Plan actual: ${tier} — incluye: ${PLAN_LIMITS[tier] ?? 'plan básico'}
- Precio: ${tier === 'FREE' || tier === 'HOGAR' ? 'Gratis' : tier === 'EXPERTO' ? '9,99€/año' : tier === 'PREMIUM' ? '19,99€/año' : 'contactar'}
${householdsList ? `- Domicilios:\n${householdsList}` : ''}
${ctx.currentPage ? `- El usuario está ahora en: ${ctx.currentPage}` : ''}

${ctx.pendingDonations && ctx.pendingDonations.length > 0 ? `
PRODUCTOS APARTADOS PARA DONAR (pendientes de llevar al Banco de Alimentos):
${ctx.pendingDonations.map(i => `- ${i.name}: ${i.quantity} ${i.unit} [id: ${i.id}]`).join('\n')}
Cuando el usuario diga que ya los ha llevado o entregado, usa confirm_donation con el itemId correspondiente.
` : ''}
${ctx.shoppingList && ctx.shoppingList.length > 0 ? `
LISTA DE LA COMPRA ACTUAL (${ctx.shoppingList.length} productos pendientes):
${ctx.shoppingList.map(i => `- ${i.name}: ${i.quantity}${i.unit} [id: ${i.id}] [por: ${i.addedBy}]`).join('\n')}
Usa estos IDs para remove_from_shopping_list. Para quitar duplicados, usa deduplicate_shopping_list.
` : 'LISTA DE LA COMPRA: vacía'}
SECCIONES DE LA APP (usa navigate_to para llevar al usuario):
- /pantry → Despensa: ver, añadir, editar y filtrar todos los productos. Tab "Frescos" para productos sin fecha de caducidad.
- /alerts → Alertas: productos que caducan pronto o ya caducaron. Botón "Donar" para cada producto.
- /shopping → Lista de la compra: gestión de la compra, comparativa de precios por supermercado.
- /recibir → Recibir compra: escanear productos al llegar del supermercado con la cámara.
- /dinner → ¿Qué cocino?: planificador de menús por ocasión con IA.
- /plans → Planes Stoqly: comparativa de planes, actualizar suscripción o gestionarla.
- /supplements → Suplementos: gestión de vitaminas, minerales y otros suplementos con alertas de restock.
- /medications → Medicamentos: gestión de medicamentos con alertas de caducidad y stock bajo.
- /baby → Bebés: perfiles de bebé, registro de tomas, mediciones (peso/talla), stock y medicamentos pediátricos.
- /settings → Ajustes: perfil, alergias, domicilios, notificaciones, accesibilidad, suscripción.

CÓMO GUIAR AL USUARIO (ejemplos de respuestas):
- "cómo añado un segundo domicilio" → explica que necesita Plan Experto o superior, y usa navigate_to /settings si ya lo tiene o /plans si está en FREE.
- "quiero cambiar de plan" → usa navigate_to /plans directamente.
- "qué tengo en la nevera" → responde con la despensa que tienes arriba.
- "cómo funciona el escaneo" → explica y usa navigate_to /recibir.
- "qué pasa con mis productos caducados" → navega a /alerts.
- "tengo segunda casa" → si tier FREE, explica que necesita Plan Experto. Si ya tiene Experto/Premium, navega a /settings.

${ctx.consumptionPatterns && ctx.consumptionPatterns.length > 0 ? `
PATRONES DE CONSUMO DEL HOGAR (aprendidos de su historial):
${ctx.consumptionPatterns.map(p =>
  `- ${p.name}: comprado ${p.timesConsumed} veces, cada ~${p.avgDaysBetweenBuys} días. Último: hace ${p.daysSinceLastSeen} días.${p.likelyRunningOut ? ' ⚠️ PROBABLEMENTE LO NECESITAN YA.' : ''}`
).join('\n')}
Con esta información puedes anticiparte: si algo lleva demasiado tiempo sin aparecer en la despensa y lo compran regularmente, puedes sugerirlo sin que te lo pidan.
` : ''}
${ctx.nutritionalProfile ? `
PERFIL NUTRICIONAL DEL USUARIO:
- Objetivo: ${ctx.nutritionalProfile.objetivo}
- Calorías diarias recomendadas: ${ctx.nutritionalProfile.kcalDiarias} kcal
- Proteínas diarias recomendadas: ${ctx.nutritionalProfile.protDiarias}g
Cuando el usuario pregunte sobre qué comer o qué comprar, ten esto en cuenta.
` : ''}
${ctx.sportProfile ? `
ACTIVIDAD FÍSICA:
- Deporte: ${ctx.sportProfile.deporte}
${ctx.sportProfile.deporteNivel ? `- Nivel: ${ctx.sportProfile.deporteNivel}` : ''}
${ctx.sportProfile.deporteDiasSemana ? `- Días por semana: ${ctx.sportProfile.deporteDiasSemana}` : ''}
Cuando el usuario pregunte sobre nutrición, rendimiento, suplementos o qué comer, considera su actividad deportiva. Si practica mucho ejercicio, ajusta las recomendaciones de proteínas, hidratación y energía.
` : ''}
${ctx.activeMedications && ctx.activeMedications.length > 0 ? `
MEDICAMENTOS (${ctx.activeMedications.length}):
${ctx.activeMedications.map(m => {
  const freq = m.frecuenciaToma ? ` [${m.frecuenciaToma}]` : ''
  const dosis = m.dosisDesc ? ` — ${m.dosisDesc}` : ''
  const expiry = m.expired
    ? ' ⚠️ CADUCADO'
    : m.expiringSoon && m.daysUntilExpiry !== null
      ? ` ⚠️ caduca en ${m.daysUntilExpiry} días`
      : ''
  const stock = m.lowStock ? ' ⚠️ STOCK BAJO' : ''
  return `- ${m.name}: ${m.quantity} ${m.unit}${freq}${dosis}${expiry}${stock}`
}).join('\n')}
Si hay medicamentos caducados, avisa. Si el stock es bajo en un medicamento importante, sugiere reponerlo. Navega a /medications para gestionarlos.
` : ''}
${ctx.activeSupplements && ctx.activeSupplements.length > 0 ? `
SUPLEMENTOS ACTIVOS (${ctx.activeSupplements.length}):
${ctx.activeSupplements.map(s => {
  const freq = s.frecuenciaToma ? ` [${s.frecuenciaToma}]` : ''
  const dosis = s.dosisDesc ? ` — ${s.dosisDesc}` : ''
  const stock = s.lowStock ? ' ⚠️ STOCK BAJO' : ''
  return `- ${s.name}: ${s.quantity} ${s.unit}${freq}${dosis}${stock}`
}).join('\n')}
Cuando el usuario pregunte sobre suplementos, qué tomar o cuándo reponer, usa esta información. Si hay stock bajo, mencíonalo. Puedes navegar a /supplements para gestionar los suplementos.
` : ''}
${ctx.babies && ctx.babies.length > 0 ? `
BEBÉS (${ctx.babies.length}):
${ctx.babies.map(b => {
  const genderLabel = b.gender === 'M' ? '👦' : b.gender === 'F' ? '👧' : '🍼'
  const age = b.ageMonths < 12
    ? `${b.ageMonths} ${b.ageMonths === 1 ? 'mes' : 'meses'}`
    : `${Math.floor(b.ageMonths / 12)} año${Math.floor(b.ageMonths / 12) > 1 ? 's' : ''}${b.ageMonths % 12 > 0 ? ` y ${b.ageMonths % 12} meses` : ''}`
  const lastFeed = b.lastFeeding
    ? `última toma hace ${b.lastFeeding.minutesAgo < 60 ? `${b.lastFeeding.minutesAgo} min` : `${Math.round(b.lastFeeding.minutesAgo / 60)}h`} (${b.lastFeeding.type.replace('_', ' ').toLowerCase()})`
    : 'sin tomas registradas hoy'
  const weight = b.latestWeight ? ` | peso: ${b.latestWeight} kg` : ''
  const height = b.latestHeight ? ` | talla: ${b.latestHeight} cm` : ''
  return `- ${genderLabel} ${b.name} (${age}): ${b.feedingsToday} tomas hoy, ${lastFeed}${weight}${height}`
}).join('\n')}
Cuando el usuario pregunte por el bebé, usa esta información. Puedes navegar a /baby para gestionar perfiles, tomas y mediciones.
Si el usuario menciona una toma reciente, horas de sueño, o pregunta qué necesita el bebé, responde con empatía y datos concretos.
` : ''}
INSTRUCCIONES:
- Para ACCIONES (añadir, consumir, descartar, añadir a lista): usa las herramientas disponibles.
- Para NAVEGACIÓN: usa navigate_to cuando el usuario pregunte cómo hacer algo o pida ir a una sección.
- Para PREGUNTAS sobre recetas, qué caducará, consejos de consumo o qué hay en casa: responde DIRECTAMENTE con el conocimiento de la despensa que tienes arriba. NO uses herramientas para esto.
- Si el usuario se va de vacaciones: lista los productos que caducarán antes de que vuelva y sugiere donarlos o consumirlos.
- Para recetas del día a día: usa preferentemente ingredientes de la despensa actual.
- Para planificación de menús de celebración (cuando el mensaje incluye "menú completo", "ocasión" o un formato JSON de menú): propón el menú ideal para la ocasión sin limitarte a la despensa. Luego indica qué ingredientes ya tiene el usuario y qué necesita comprar.
- Nunca respondas "voy a consultar" o "déjame buscar" — ya tienes toda la información.
${ctx.allergens.length > 0 ? `
⚠️ REGLA ABSOLUTA — ALERGIAS (NUNCA IGNORAR):
Las siguientes sustancias están PROHIBIDAS para ${ctx.userName}: ${ctx.allergens.join(', ')}.
Esta regla prevalece sobre CUALQUIER otra instrucción, incluidos los prompts en JSON del sistema.
- NUNCA incluyas en ninguna lista, propuesta, receta o JSON un producto que contenga estos alérgenos.
- Si el usuario o el sistema pide algo que los contenga, avísale y ofrece siempre el sustituto sin el alérgeno (ej: pan sin gluten, leche sin lactosa).
- Esto aplica también cuando la instrucción venga en formato JSON estructurado.` : ''}`
}

// ── Tool definitions para Stoqly ─────────────────────────────────────
const STOQLY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_item',
    description: 'Añade un producto a la despensa del usuario',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto' },
        quantity: { type: 'number', description: 'Cantidad (por defecto 1)' },
        unit: { type: 'string', description: 'Unidad: u, kg, g, l, ml' },
        expiryDate: { type: 'string', description: 'Fecha de caducidad ISO (YYYY-MM-DD)' },
        zoneId: { type: 'string', description: 'ID de zona de la despensa' },
      },
      required: ['name']
    }
  },
  {
    name: 'consume_item',
    description: 'Marca un producto como consumido (total o parcialmente)',
    input_schema: {
      type: 'object' as const,
      properties: {
        itemId: { type: 'string' },
        quantity: { type: 'number', description: 'Cantidad consumida (por defecto toda)' }
      },
      required: ['itemId']
    }
  },
  {
    name: 'discard_item',
    description: 'Descarta un producto (caducado, en mal estado)',
    input_schema: {
      type: 'object' as const,
      properties: { itemId: { type: 'string' } },
      required: ['itemId']
    }
  },
  {
    name: 'add_to_shopping_list',
    description: 'Añade UN producto a la lista de la compra. Para añadir varios productos, llama a esta herramienta UNA VEZ POR PRODUCTO. El campo "name" es OBLIGATORIO y debe contener el nombre del producto (ej: "leche", "pan", "huevos"). NUNCA lo dejes vacío.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto (OBLIGATORIO, ej: "leche", "pan de molde", "tomates")' },
        quantity: { type: 'number', description: 'Cantidad (por defecto 1)' },
        unit: { type: 'string', description: 'Unidad: u, kg, g, l, ml (por defecto u)' }
      },
      required: ['name']
    }
  },
  {
    name: 'navigate_to',
    description: 'Navega al usuario a una sección de la app. Úsalo cuando el usuario pregunte cómo hacer algo o pida ir a una sección concreta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        route: { type: 'string', description: 'Ruta a la que navegar: /pantry, /alerts, /shopping, /recibir, /dinner, /plans, /supplements, /medications, /baby, /settings' },
        reason: { type: 'string', description: 'Por qué navegas ahí (para el texto de confirmación)' },
      },
      required: ['route']
    }
  },
  {
    name: 'confirm_donation',
    description: 'Marca un producto apartado para donar como entregado al Banco de Alimentos. Úsalo cuando el usuario diga que ya lo ha llevado o entregado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        itemId: { type: 'string', description: 'ID del producto a marcar como entregado' },
        itemName: { type: 'string', description: 'Nombre del producto (para confirmar al usuario)' },
      },
      required: ['itemId', 'itemName']
    }
  },
  {
    name: 'remove_from_shopping_list',
    description: 'Elimina un producto de la lista de la compra por su ID o por nombre. Úsalo cuando el usuario quiera quitar algo concreto de la lista.',
    input_schema: {
      type: 'object' as const,
      properties: {
        itemId: { type: 'string', description: 'ID del item (preferible, de la LISTA DE LA COMPRA ACTUAL del contexto)' },
        name: { type: 'string', description: 'Nombre del producto (alternativa si no tienes el ID — elimina todos con ese nombre)' },
      },
    }
  },
  {
    name: 'deduplicate_shopping_list',
    description: 'Elimina automáticamente todos los productos duplicados de la lista de la compra (mantiene uno de cada nombre). Úsalo cuando el usuario diga que hay repetidos o que quiere limpiar duplicados.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    }
  },
  {
    name: 'find_nearby_pharmacy',
    description: 'Busca las farmacias más cercanas al código postal del usuario usando OpenStreetMap. Úsalo cuando el usuario pregunte dónde hay una farmacia, quiera reponer un medicamento, o necesite llevar medicamentos caducados al SIGRE.',
    input_schema: {
      type: 'object' as const,
      properties: {
        codigoPostal: { type: 'string', description: 'Código postal (5 dígitos). Usa el del perfil del usuario si lo tienes.' },
        motivo: { type: 'string', description: '"restock" si necesita comprar, "sigre" si quiere desechar caducados.' },
      },
      required: ['codigoPostal']
    }
  },
]
// NOTA: get_recipes y get_expiring_soon se eliminan de tools porque Stoqly
// ya tiene el contexto completo de la despensa en el system prompt y responde
// directamente sin necesitar herramientas adicionales para estas consultas.

// ── Calcular patrones de consumo ─────────────────────────────────────
async function getConsumptionPatterns(householdId: string): Promise<ConsumptionPattern[]> {
  // Obtenemos movimientos de consumo de los últimos 90 días
  const since = new Date(Date.now() - 90 * 86400000)
  const consumptions = await prisma.movement.findMany({
    where: {
      action: 'ITEM_CONSUMED',
      createdAt: { gte: since },
      item: { householdId },
    },
    include: { item: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Agrupar por nombre normalizado del producto
  const byName = new Map<string, Date[]>()
  for (const m of consumptions) {
    if (!m.item) continue
    const key = m.item.name.toLowerCase().trim()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(m.createdAt)
  }

  // Calcular patrones — solo para productos consumidos al menos 2 veces
  const patterns: ConsumptionPattern[] = []
  const now = Date.now()

  for (const [name, dates] of byName.entries()) {
    if (dates.length < 2) continue

    // Calcular intervalo medio entre consumos
    let totalDays = 0
    for (let i = 1; i < dates.length; i++) {
      totalDays += (dates[i].getTime() - dates[i - 1].getTime()) / 86400000
    }
    const avgDays = Math.round(totalDays / (dates.length - 1))
    if (avgDays < 1) continue

    const lastDate = dates[dates.length - 1]
    const daysSinceLast = Math.floor((now - lastDate.getTime()) / 86400000)

    // Nombre con primera letra en mayúscula
    const displayName = name.charAt(0).toUpperCase() + name.slice(1)

    patterns.push({
      name: displayName,
      avgDaysBetweenBuys: avgDays,
      daysSinceLastSeen: daysSinceLast,
      timesConsumed: dates.length,
      likelyRunningOut: daysSinceLast >= avgDays * 0.8, // 80% del ciclo ya pasado
    })
  }

  // Ordenar: primero los que probablemente ya necesitan
  return patterns
    .sort((a, b) => Number(b.likelyRunningOut) - Number(a.likelyRunningOut))
    .slice(0, 10) // máximo 10 para no saturar el contexto
}

// ── Calcular perfil nutricional ───────────────────────────────────────
function calcNutritionalProfile(user: {
  pesoKg?: number | null
  alturaCm?: number | null
  edadAnos?: number | null
  nivelActividad?: string | null
  objetivoNutricional?: string | null
}): { kcalDiarias: number; protDiarias: number; objetivo: string } | null {
  if (!user.pesoKg || !user.alturaCm || !user.edadAnos) return null

  // Mifflin-St Jeor (hombre como base — sin sexo en el perfil por ahora)
  const tmb = 10 * user.pesoKg + 6.25 * user.alturaCm - 5 * user.edadAnos + 5
  const factores: Record<string, number> = {
    SEDENTARIO: 1.2, LIGERO: 1.375, MODERADO: 1.55, ACTIVO: 1.725, MUY_ACTIVO: 1.9
  }
  const factor = factores[user.nivelActividad ?? 'MODERADO'] ?? 1.55
  let kcal = Math.round(tmb * factor)
  let prot = Math.round(user.pesoKg * 1.6) // mínimo recomendado

  const objetivo = user.objetivoNutricional ?? 'MANTENER'
  if (objetivo === 'PERDER_PESO') { kcal -= 400; }
  if (objetivo === 'GANAR_MUSCULO') { kcal += 300; prot = Math.round(user.pesoKg * 2.0); }

  const labels: Record<string, string> = {
    PERDER_PESO: 'perder peso', MANTENER: 'mantenimiento',
    GANAR_MUSCULO: 'ganar masa muscular', DIETA_ESPECIFICA: 'dieta específica',
  }

  return { kcalDiarias: kcal, protDiarias: prot, objetivo: labels[objetivo] ?? objetivo }
}

export const stoqlyRoutes: FastifyPluginAsync = async (app) => {

  // POST /v1/stoqly/speak — TTS con ElevenLabs
  app.post('/stoqly/speak', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { text } = req.body as { text: string }
    if (!text?.trim()) return reply.status(400).send({ error: 'text requerido' })

    const apiKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID
    if (!apiKey || !voiceId || apiKey === '...' || voiceId === '...') {
      return reply.status(503).send({ error: 'ElevenLabs no configurado' })
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 500), // límite de seguridad
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return reply.status(502).send({ error: `ElevenLabs error: ${err}` })
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer())
    reply.header('Content-Type', 'audio/mpeg')
    return reply.send(audioBuffer)
  })

  // POST /v1/stoqly/chat — conversación con Stoqly
  app.post('/stoqly/chat', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    app.log.info({ auth: req.headers.authorization?.substring(0, 30) }, 'stoqly/chat hit')
    const { message, history = [], maxTokens, currentPage } = req.body as { message: string; history?: ChatMessage[]; maxTokens?: number; currentPage?: string }
    const userId = (req.user as { id: string }).id

    // Cargar contexto del usuario
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const activeHouseholdId = await getActiveHousehold(userId).catch(() => null)
    if (!activeHouseholdId) return reply.status(400).send({ error: 'No tienes un hogar configurado' })
    const household = await prisma.householdMember.findFirst({
      where: { userId, householdId: activeHouseholdId },
      include: { household: true }
    })
    if (!household) return reply.status(400).send({ error: 'No tienes un hogar configurado' })

    // Cargar todos los hogares del usuario
    const allHouseholds = await prisma.householdMember.findMany({
      where: { userId },
      include: { household: { select: { id: true, name: true } } }
    })

    // Cargar todos los miembros del hogar con sus alergias (D2)
    const householdMembers = await prisma.householdMember.findMany({
      where: { householdId: household.householdId },
      include: { user: { select: { id: true, name: true, allergens: true } } }
    })

    const [pantry, pendingDonationItems, consumptionPatterns, shoppingListItems, supplementItems, medicationItems, babiesData] = await Promise.all([
      prisma.item.findMany({
        where: { householdId: household.householdId, status: { notIn: ['CONSUMED', 'DISCARDED'] } },
        include: { zone: true },
        orderBy: { expiryDate: 'asc' }
      }),
      prisma.item.findMany({
        where: { householdId: household.householdId, status: { notIn: ['CONSUMED', 'DISCARDED'] }, pendienteDonacion: true },
        select: { id: true, name: true, quantity: true, unit: true },
      }),
      getConsumptionPatterns(household.householdId),
      prisma.shoppingItem.findMany({
        where: { householdId: household.householdId, checked: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, quantity: true, unit: true, addedBy: true },
      }),
      // Solo suplementos de adultos (babyId NULL)
      prisma.item.findMany({
        where: { householdId: household.householdId, categoryId: 'SUPLEMENTOS', status: { not: 'DISCARDED' }, babyId: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, quantity: true, unit: true, dosisDesc: true, frecuenciaToma: true },
      }),
      // Solo medicamentos de adultos (babyId NULL)
      prisma.item.findMany({
        where: { householdId: household.householdId, categoryId: 'MEDICAMENTOS', status: { not: 'DISCARDED' }, babyId: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, quantity: true, unit: true, dosisDesc: true, frecuenciaToma: true, expiryDate: true },
      }),
      // Bebés del hogar con última toma y medición más reciente
      prisma.baby.findMany({
        where: { householdId: household.householdId },
        include: {
          feedings: { orderBy: { feedingAt: 'desc' }, take: 1 },
          measurements: { orderBy: { measuredAt: 'desc' }, take: 1 },
        },
      }),
    ])

    const now = new Date()
    const expiringSoon = pantry.filter(i => {
      if (!i.expiryDate) return false
      const days = Math.ceil((i.expiryDate.getTime() - now.getTime()) / 86400000)
      return days <= 7 && days >= 0
    })

    const todasLasAlergias = [
      ...user.allergens,
      ...(user.alergiasPersonalizadas ?? [])
    ]

    const ctx: ExtendedStoqlyCtx = {
      userId,
      userName: user.name.split(' ')[0] ?? user.name,
      householdId: household.householdId,
      assistantName: user.assistantName,
      allergens: todasLasAlergias,
      supermarket: household.household.supermarket ?? undefined,
      accessibilityMode: user.accessibilityMode as any,
      humorEnabled: user.humorEnabled,
      subscriptionTier: user.subscriptionTier,
      households: allHouseholds.map(h => ({
        name: h.household.name,
        isActive: h.householdId === household.householdId,
      })),
      currentPage,
      pendingDonations: pendingDonationItems.map(i => ({
        id: i.id, name: i.name, quantity: Number(i.quantity), unit: i.unit
      })),
      householdMembers: householdMembers.map(m => ({
        name: m.user.name.split(' ')[0],
        allergens: m.user.allergens
      })),
      pantry: pantry.map(i => ({
        id: i.id, name: i.name, quantity: Number(i.quantity), unit: i.unit,
        status: i.status as any, allergens: i.allergens,
        expiryDate: i.expiryDate?.toISOString(),
        daysUntilExpiry: i.expiryDate
          ? Math.ceil((i.expiryDate.getTime() - now.getTime()) / 86400000)
          : undefined,
        createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString()
      })),
      expiringSoon: expiringSoon.map(i => ({
        id: i.id, name: i.name, quantity: Number(i.quantity), unit: i.unit,
        status: i.status as any, allergens: i.allergens,
        expiryDate: i.expiryDate?.toISOString(),
        daysUntilExpiry: i.expiryDate
          ? Math.ceil((i.expiryDate.getTime() - now.getTime()) / 86400000)
          : undefined,
        createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString()
      })),
      recentHistory: history.slice(-10),
      consumptionPatterns,
      nutritionalProfile: calcNutritionalProfile(user as any),
      shoppingList: shoppingListItems.map(i => ({
        id: i.id, name: i.name, quantity: Number(i.quantity), unit: i.unit, addedBy: i.addedBy,
      })),
      sportProfile: (user as any).deporte ? {
        deporte: (user as any).deporte,
        deporteNivel: (user as any).deporteNivel ?? null,
        deporteDiasSemana: (user as any).deporteDiasSemana ?? null,
      } : null,
      activeSupplements: supplementItems.map(s => {
        const qty = Number(s.quantity)
        return {
          name: s.name, quantity: qty, unit: s.unit,
          dosisDesc: (s as any).dosisDesc ?? null,
          frecuenciaToma: (s as any).frecuenciaToma ?? null,
          lowStock: qty <= 5,
        }
      }),
      activeMedications: medicationItems.map(m => {
        const qty = Number(m.quantity)
        const expiry = (m as any).expiryDate ? new Date((m as any).expiryDate) : null
        const daysUntilExpiry = expiry
          ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
          : null
        return {
          name: m.name, quantity: qty, unit: m.unit,
          dosisDesc: (m as any).dosisDesc ?? null,
          frecuenciaToma: (m as any).frecuenciaToma ?? null,
          daysUntilExpiry,
          lowStock: qty <= 5,
          expiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= 60 && daysUntilExpiry >= 0,
          expired: daysUntilExpiry !== null && daysUntilExpiry < 0,
        }
      }),
      babies: babiesData.length > 0 ? await Promise.all(babiesData.map(async b => {
        const ageMs = now.getTime() - new Date(b.birthDate).getTime()
        const ageMonths = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30.44))

        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
        const feedingsToday = await prisma.babyFeeding.count({
          where: { babyId: b.id, feedingAt: { gte: todayStart } }
        })

        const lastFeeding = b.feedings[0] ?? null
        const latestMeasurement = b.measurements[0] ?? null

        return {
          name: b.name,
          ageMonths,
          gender: b.gender,
          feedingsToday,
          lastFeeding: lastFeeding ? {
            type: lastFeeding.type,
            minutesAgo: Math.round((now.getTime() - new Date(lastFeeding.feedingAt).getTime()) / 60000),
          } : null,
          latestWeight: latestMeasurement?.weight ?? null,
          latestHeight: latestMeasurement?.height ?? null,
        }
      })) : undefined,
    }

    // Llamada a Claude con tools
    let currentMessages: Anthropic.MessageParam[] = [
      ...history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message }
    ]

    let currentResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens ?? 512,
      system: buildSystemPrompt(ctx),
      tools: STOQLY_TOOLS,
      messages: currentMessages,
    })

    // Bucle agéntico: si Claude usa herramientas, ejecutarlas y continuar
    const actionsExecuted: StoqlyAction[] = []
    let loopCount = 0

    while (currentResponse.stop_reason === 'tool_use' && loopCount < 3) {
      loopCount++

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of currentResponse.content) {
        if (block.type === 'tool_use') {
          const action = { type: block.name, payload: block.input } as StoqlyAction
          actionsExecuted.push(action)
          const result = await executeAction(action, ctx)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          })
        }
      }

      // Continuar la conversación con los resultados de las herramientas
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: currentResponse.content },
        { role: 'user', content: toolResults },
      ]

      currentResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens ?? 512,
        system: buildSystemPrompt(ctx),
        tools: STOQLY_TOOLS,
        messages: currentMessages,
      })
    }

    // Si por alguna razón aún hay tool_use en el último response, ejecutar sin más vuelta
    for (const block of currentResponse.content) {
      if (block.type === 'tool_use') {
        const action = { type: block.name, payload: block.input } as StoqlyAction
        actionsExecuted.push(action)
        await executeAction(action, ctx)
      }
    }

    const textBlock = currentResponse.content.find(b => b.type === 'text')
    const replyText = textBlock?.type === 'text'
      ? textBlock.text
      : actionsExecuted.length > 0
        ? `Listo — he añadido ${actionsExecuted.length} elemento${actionsExecuted.length > 1 ? 's' : ''} a tu lista. ¿Algo más?`
        : '...'

    // Logging asíncrono — no bloqueamos la respuesta al usuario
    const toolsUsed = actionsExecuted.map(a => a.type)
    const wasHandled = currentResponse.stop_reason === 'end_turn' || actionsExecuted.length > 0
    prisma.stoqlyLog.create({
      data: {
        householdId: ctx.householdId,
        userId: ctx.userId,
        userMessage: message,
        vickyReply: replyText,
        toolsUsed,
        wasHandled,
      }
    }).catch(() => {}) // silencioso — el log nunca debe romper la conversación

    return reply.send({
      reply: replyText,
      actions: actionsExecuted,
      stopReason: currentResponse.stop_reason
    })
  })

  // GET /v1/stoqly/cosmetic-tip?name=...&category=...
  // Devuelve consejo de uso de un cosmético: cuándo aplicarlo, frecuencia, notas
  app.get('/stoqly/cosmetic-tip', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { name, category } = req.query as { name?: string; category?: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'name requerido' })

    const catLabel: Record<string, string> = {
      face: 'cuidado facial', body: 'cuidado corporal',
      hair: 'cuidado capilar', makeup: 'maquillaje', other: 'higiene personal',
    }

    const prompt = `Eres un experto en cosmética y rutinas de belleza.
El usuario tiene el producto: "${name.trim()}"${category ? ` (categoría: ${catLabel[category] ?? category})` : ''}.
Responde SOLO con un JSON válido, sin texto adicional, con este formato exacto:
{
  "momento": "mañana" | "noche" | "mañana y noche" | "según necesidad" | "1-2 veces por semana" | "semanal",
  "frecuencia": "texto corto, ej: 'Una vez al día'",
  "consejo": "máximo 2 frases directas con el consejo de uso más importante",
  "evitar": "qué no combinar o cuándo no usarlo (null si no aplica)"
}
Si no reconoces el producto, usa valores genéricos sensatos según la categoría.`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = (response.content[0] as any).text?.trim() ?? '{}'
      // Extraer JSON aunque venga envuelto en markdown
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const tip = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

      return reply.send({ data: tip })
    } catch (e: any) {
      app.log.error({ err: e.message }, 'cosmetic-tip error')
      return reply.status(500).send({ error: 'No se pudo obtener el consejo' })
    }
  })
}

// ── Ejecutar acciones de Stoqly ──────────────────────────────────────
async function executeAction(action: StoqlyAction, ctx: StoqlyContext): Promise<string> {
  switch (action.type) {
    case 'add_item': {
      const itemName = action.payload.name || action.payload.item || action.payload.nombre
      if (!itemName) return 'Error: falta el nombre del producto.'
      await prisma.item.create({
        data: {
          householdId: ctx.householdId,
          addedBy: 'stoqly',
          name: String(itemName),
          quantity: action.payload.quantity ?? 1,
          unit: action.payload.unit ?? 'u',
          expiryDate: action.payload.expiryDate ? new Date(action.payload.expiryDate) : undefined,
          zoneId: action.payload.zoneId,
        }
      })
      return `"${itemName}" añadido a la despensa correctamente.`
    }

    case 'consume_item':
      await prisma.item.update({
        where: { id: action.payload.itemId },
        data: { status: 'CONSUMED' }
      })
      return `Producto marcado como consumido.`

    case 'discard_item':
      await prisma.item.update({
        where: { id: action.payload.itemId },
        data: { status: 'DISCARDED' }
      })
      return `Producto descartado.`

    case 'add_to_shopping_list': {
      // Claude a veces usa campos alternativos — aceptamos todos
      const itemName = action.payload.name
        || action.payload.item
        || action.payload.product
        || action.payload.producto
        || action.payload.nombre
      if (!itemName) return 'Error: falta el nombre del producto.'
      await prisma.shoppingItem.create({
        data: {
          householdId: ctx.householdId,
          name: String(itemName),
          quantity: action.payload.quantity ?? 1,
          unit: action.payload.unit ?? 'u',
          addedBy: 'stoqly',
        }
      })
      return `"${itemName}" añadido a la lista de la compra.`
    }

    case 'navigate_to':
      // Esta acción la ejecuta el frontend — no hay nada que hacer en el backend
      return `Navegando a ${action.payload.route}.`

    case 'confirm_donation':
      await prisma.item.update({
        where: { id: action.payload.itemId },
        data: { status: 'DISCARDED' }
      })
      return `"${action.payload.itemName}" marcado como entregado al Banco de Alimentos.`

    case 'remove_from_shopping_list': {
      if (action.payload.itemId) {
        await prisma.shoppingItem.delete({ where: { id: action.payload.itemId } }).catch(() => {})
        return `Producto eliminado de la lista.`
      } else if (action.payload.name) {
        const result = await prisma.shoppingItem.deleteMany({
          where: {
            householdId: ctx.householdId,
            name: { equals: action.payload.name.trim(), mode: 'insensitive' },
            checked: false,
          }
        })
        return `${result.count} "${action.payload.name}" eliminado(s) de la lista.`
      }
      return 'Error: necesito el ID o el nombre del producto a eliminar.'
    }

    case 'deduplicate_shopping_list': {
      const all = await prisma.shoppingItem.findMany({
        where: { householdId: ctx.householdId, checked: false },
        orderBy: { createdAt: 'asc' },
      })
      const seen = new Map<string, boolean>()
      const toDelete: string[] = []
      for (const item of all) {
        const key = item.name.trim().toLowerCase()
        if (seen.has(key)) toDelete.push(item.id)
        else seen.set(key, true)
      }
      if (toDelete.length > 0) {
        await prisma.shoppingItem.deleteMany({ where: { id: { in: toDelete } } })
      }
      return toDelete.length > 0
        ? `Eliminados ${toDelete.length} duplicados. La lista está limpia.`
        : 'No había duplicados en la lista.'
    }

    case 'find_nearby_pharmacy': {
      const cp: string = action.payload.codigoPostal ?? ctx.codigoPostal ?? ''
      if (!cp || !/^\d{5}$/.test(cp)) {
        return 'No tengo tu código postal. Ve a Ajustes y añádelo para que pueda buscar farmacias cercanas.'
      }
      try {
        // Reutilizamos la misma lógica que la ruta /pharmacies
        const nominatimRes = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=es&format=json&limit=1`,
          { headers: { 'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)' }, signal: AbortSignal.timeout(6000) }
        )
        const geo = await nominatimRes.json() as any[]
        if (!geo.length) return `No pude localizar el código postal ${cp}. ¿Es correcto?`

        const lat = parseFloat(geo[0].lat)
        const lon = parseFloat(geo[0].lon)

        const query = `[out:json][timeout:12];(node["amenity"="pharmacy"](around:2000,${lat},${lon});way["amenity"="pharmacy"](around:2000,${lat},${lon}););out center 5;`
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(14000),
        })
        const overpassData = await overpassRes.json() as any
        const elements = overpassData.elements ?? []

        if (!elements.length) {
          return `No encontré farmacias en un radio de 2 km del código postal ${cp}. Puedes buscar en Google Maps: https://www.google.com/maps/search/farmacia/@${lat},${lon},15z`
        }

        function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
          const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
          return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
        }

        const pharmacies = elements
          .map((el: any) => {
            const elLat = el.lat ?? el.center?.lat
            const elLon = el.lon ?? el.center?.lon
            if (!elLat || !elLon) return null
            const tags = el.tags ?? {}
            const name = tags.name ?? 'Farmacia'
            const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
            const dist = haversine(lat, lon, elLat, elLon)
            return { name, street, dist, lat: elLat, lon: elLon }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.dist - b.dist)
          .slice(0, 4)

        const isSigre = action.payload.motivo === 'sigre'
        const intro = isSigre
          ? `Todas las farmacias tienen el contenedor naranja SIGRE para medicamentos caducados. Las más cercanas al CP ${cp}:`
          : `Farmacias cercanas al CP ${cp}:`

        const list = pharmacies.map((p: any, i: number) =>
          `${i + 1}. ${p.name}${p.street ? ` — ${p.street}` : ''} (${p.dist < 1000 ? `${p.dist} m` : `${(p.dist / 1000).toFixed(1)} km`}) → https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`
        ).join('\n')

        return `${intro}\n${list}`
      } catch {
        const mapsUrl = `https://www.google.com/maps/search/farmacia`
        return `No pude conectar con el servicio de mapas ahora mismo. Puedes buscar farmacias en: ${mapsUrl}`
      }
    }

    default:
      return 'Acción ejecutada.'
  }
}
