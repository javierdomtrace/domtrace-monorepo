import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const ZoneBody = z.object({
  name: z.string().min(1),
  icon: z.string().default('📦'),
  temperatureType: z.enum(['COLD', 'AMBIENT', 'FROZEN', 'WARM']),
  position: z.number().int().default(0),
})

async function getActiveHousehold(userId: string) {
  const member = await prisma.householdMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } })
  if (!member) throw new Error('NO_HOUSEHOLD')
  return member.householdId
}

export const pantryRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/pantry/zones
  app.get('/pantry/zones', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)

    const zones = await prisma.pantryZone.findMany({
      where: { householdId },
      include: { _count: { select: { items: { where: { status: { notIn: ['CONSUMED', 'DISCARDED'] } } } } } },
      orderBy: { position: 'asc' },
    })

    return reply.send({ data: zones.map(z => ({ ...z, itemCount: z._count.items })) })
  })

  // POST /v1/pantry/zones
  app.post('/pantry/zones', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const body = ZoneBody.parse(req.body)

    const zone = await prisma.pantryZone.create({ data: { householdId, ...body } })
    return reply.status(201).send({ data: zone })
  })

  // PUT /v1/pantry/zones/:id
  app.put('/pantry/zones/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = ZoneBody.partial().parse(req.body)
    const zone = await prisma.pantryZone.update({ where: { id }, data: body })
    return reply.send({ data: zone })
  })

  // DELETE /v1/pantry/zones/:id
  app.delete('/pantry/zones/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    // Mover items a sin zona antes de eliminar
    await prisma.item.updateMany({ where: { zoneId: id }, data: { zoneId: null } })
    await prisma.pantryZone.delete({ where: { id } })
    return reply.status(204).send()
  })

  // GET /v1/pantry/zones/:id/items
  app.get('/pantry/zones/:id/items', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const items = await prisma.item.findMany({
      where: { zoneId: id, status: { notIn: ['CONSUMED', 'DISCARDED'] } },
      orderBy: { expiryDate: 'asc' },
    })
    return reply.send({ data: items.map(i => ({ ...i, quantity: Number(i.quantity) })) })
  })
}
