import type { FastifyPluginAsync } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@domtrace/db'
import type { StoqlyContext, StoqlyAction, ChatMessage } from '@domtrace/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── System prompt de Stoqly ──────────────────────────────────────────
function buildSystemPrompt(ctx: StoqlyContext): string {
  const humor = ctx.humorEnabled && ctx.accessibilityMode === 'VOICE'
    ? 'Puedes usar un toque de humor ligero y situacional — máximo una vez por conversación. Nunca fuerces el chiste. Si el usuario responde seco, baja el tono.'
    : 'Mantén un tono cálido y amigable, sin humor.'

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
- Alergias/intolerancias: ${ctx.allergens.length > 0 ? ctx.allergens.join(', ') : 'ninguna'}
- Supermercado preferido: ${ctx.supermarket ?? 'no configurado'}
- Accesibilidad: ${ctx.accessibilityMode}

DESPENSA ACTUAL (${ctx.pantry.length} productos):
${ctx.pantry.slice(0, 30).map(i =>
  `- ${i.name}: ${i.quantity}${i.unit}${i.expiryDate ? `, caduca ${i.daysUntilExpiry !== undefined ? `en ${i.daysUntilExpiry} días` : i.expiryDate}` : ''}`
).join('\n')}

PRÓXIMOS A CADUCAR:
${ctx.expiringSoon.length > 0
  ? ctx.expiringSoon.map(i => `- ${i.name}: ${i.daysUntilExpiry} días`).join('\n')
  : '- Ninguno urgente ahora mismo'}

Cuando el usuario mencione productos, acciones o preguntas sobre su despensa, usa las herramientas disponibles para actuar. No preguntes si ya tienes la información.`
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
    description: 'Añade un producto a la lista de la compra',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'get_recipes',
    description: 'Sugiere recetas posibles con los ingredientes actuales de la despensa',
    input_schema: {
      type: 'object' as const,
      properties: {
        preferExpiring: { type: 'boolean', description: 'Priorizar ingredientes próximos a caducar' }
      }
    }
  }
]

export const stoqlyRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/stoqly/chat — conversación con Stoqly
  app.post('/stoqly/chat', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { message, history = [] } = req.body as { message: string; history?: ChatMessage[] }
    const userId = (req.user as { id: string }).id

    // Cargar contexto del usuario
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const household = await prisma.householdMember.findFirst({
      where: { userId },
      include: { household: true }
    })
    if (!household) return reply.status(400).send({ error: 'No tienes un hogar configurado' })

    const pantry = await prisma.item.findMany({
      where: { householdId: household.householdId, status: { notIn: ['CONSUMED', 'DISCARDED'] } },
      include: { zone: true },
      orderBy: { expiryDate: 'asc' }
    })

    const now = new Date()
    const expiringSoon = pantry.filter(i => {
      if (!i.expiryDate) return false
      const days = Math.ceil((i.expiryDate.getTime() - now.getTime()) / 86400000)
      return days <= 7 && days >= 0
    })

    const ctx: StoqlyContext = {
      userId,
      userName: user.name.split(' ')[0] ?? user.name,
      householdId: household.householdId,
      assistantName: user.assistantName,
      allergens: user.allergens,
      supermarket: household.household.supermarket ?? undefined,
      accessibilityMode: user.accessibilityMode as any,
      humorEnabled: user.humorEnabled,
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
      recentHistory: history.slice(-10)
    }

    // Llamada a Claude con tools
    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildSystemPrompt(ctx),
      tools: STOQLY_TOOLS,
      messages
    })

    // Ejecutar tool calls si las hay
    const actionsExecuted: StoqlyAction[] = []
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const action = { type: block.name, payload: block.input } as StoqlyAction
        actionsExecuted.push(action)
        await executeAction(action, ctx)
      }
    }

    const textBlock = response.content.find(b => b.type === 'text')
    const replyText = textBlock?.type === 'text' ? textBlock.text : '...'

    return reply.send({
      reply: replyText,
      actions: actionsExecuted,
      stopReason: response.stop_reason
    })
  })
}

// ── Ejecutar acciones de Stoqly ──────────────────────────────────────
async function executeAction(action: StoqlyAction, ctx: StoqlyContext) {
  switch (action.type) {
    case 'add_item':
      await prisma.item.create({
        data: {
          householdId: ctx.householdId,
          addedBy: 'stoqly',
          name: action.payload.name,
          quantity: action.payload.quantity ?? 1,
          unit: action.payload.unit ?? 'u',
          expiryDate: action.payload.expiryDate ? new Date(action.payload.expiryDate) : undefined,
          zoneId: action.payload.zoneId,
        }
      })
      break
    case 'consume_item':
      await prisma.item.update({
        where: { id: action.payload.itemId },
        data: { status: 'CONSUMED' }
      })
      break
    case 'discard_item':
      await prisma.item.update({
        where: { id: action.payload.itemId },
        data: { status: 'DISCARDED' }
      })
      break
    case 'add_to_shopping_list':
      await prisma.shoppingItem.create({
        data: {
          householdId: ctx.householdId,
          name: action.payload.name,
          quantity: action.payload.quantity ?? 1,
          unit: action.payload.unit ?? 'u',
          addedBy: 'stoqly',
        }
      })
      break
  }
}
