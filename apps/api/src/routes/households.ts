import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold, HOUSEHOLD_LIMITS } from '../lib/household.js'

const CreateHouseholdBody = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['HOME', 'WAREHOUSE']).default('HOME'),
})

export const householdRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/households — listar todos los hogares del usuario
  app.get('/households', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id

    let activeHouseholdId: string | null = null
    try { activeHouseholdId = await getActiveHousehold(userId) } catch {}

    const memberships = await prisma.householdMember.findMany({
      where: { userId },
      include: {
        household: {
          include: {
            _count: { select: { items: { where: { status: { notIn: ['CONSUMED', 'DISCARDED'] } } } } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    return reply.send({
      data: memberships.map(m => ({
        id: m.household.id,
        name: m.household.name,
        type: m.household.type,
        role: m.role,
        isActive: m.householdId === activeHouseholdId,
        itemCount: m.household._count.items,
        joinedAt: m.joinedAt,
      })),
    })
  })

  // POST /v1/households — crear nuevo hogar (limitado por tier)
  app.post('/households', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const body = CreateHouseholdBody.parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionTier: true },
    })

    const limit = HOUSEHOLD_LIMITS[user.subscriptionTier] ?? 1
    const currentCount = await prisma.householdMember.count({ where: { userId } })

    if (currentCount >= limit) {
      return reply.status(403).send({
        error: `Tu plan ${user.subscriptionTier} permite hasta ${limit} hogar${limit === 1 ? '' : 'es'}. Mejora tu plan para añadir más.`,
        code: 'HOUSEHOLD_LIMIT_REACHED',
        currentTier: user.subscriptionTier,
        limit,
      })
    }

    const household = await prisma.household.create({
      data: {
        name: body.name,
        type: body.type as any,
        ownerId: userId,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    })

    return reply.status(201).send({ data: { id: household.id, name: household.name } })
  })

  // PATCH /v1/households/active — cambiar hogar activo
  app.patch('/households/active', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { householdId } = req.body as { householdId: string }

    if (!householdId) return reply.status(400).send({ error: 'householdId requerido' })

    // Verificar que el usuario es miembro
    const member = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
    })
    if (!member) return reply.status(403).send({ error: 'No eres miembro de ese hogar', code: 'FORBIDDEN' })

    await prisma.user.update({
      where: { id: userId },
      data: { activeHouseholdId: householdId },
    })

    return reply.send({ data: { ok: true, activeHouseholdId: householdId } })
  })

  // DELETE /v1/households/:id — eliminar hogar (solo owner)
  app.delete('/households/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }

    const household = await prisma.household.findUnique({ where: { id } })
    if (!household) return reply.status(404).send({ error: 'Hogar no encontrado' })
    if (household.ownerId !== userId) return reply.status(403).send({ error: 'Solo el propietario puede eliminar el hogar' })

    // No se puede eliminar si es el único hogar
    const count = await prisma.householdMember.count({ where: { userId } })
    if (count <= 1) return reply.status(400).send({ error: 'No puedes eliminar tu único hogar' })

    await prisma.household.delete({ where: { id } })

    // Si era el hogar activo, limpiar activeHouseholdId
    await prisma.user.updateMany({
      where: { activeHouseholdId: id },
      data: { activeHouseholdId: null },
    })

    return reply.status(204).send()
  })
}
