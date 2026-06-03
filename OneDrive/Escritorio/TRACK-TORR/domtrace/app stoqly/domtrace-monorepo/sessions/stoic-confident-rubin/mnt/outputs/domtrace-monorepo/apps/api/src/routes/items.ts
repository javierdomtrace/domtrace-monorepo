import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const CreateItemBody = z.object({
  name: z.string().min(1),
  barcode: z.string().optional(),
  epc: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  openedAt: z.string().datetime().optional(),
  paoMonths: z.number().int().optional(),
  quantity: z.number().positive().default(1),
  unit: z.string().default('u'),
  zoneId: z.string().uuid().optional(),
  tagId: z.string().optional(),
  price: z.number().nonnegative().optional(),
  allergens: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

const ItemFilters = z.object({
  zoneId: z.string().uuid().optional(),
  expiringSoon: z.coerce.boolean().optional(),
  expired: z.coerce.boolean().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['expiryDate', 'name', 'createdAt']).default('expiryDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

async function getActiveHousehold(userId: string) {
  const member = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  })
  if (!member) throw new Error('NO_HOUSEHOLD')
  return member.householdId
}

function daysUntilExpiry(date: Date | null): number | undefined {
  if (!date) return undefined
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

export const itemRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/items
  app.get('/items', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const filters = ItemFilters.parse(req.query)
    const now = new Date()

    const where: any = {
      householdId,
      status: { notIn: ['CONSUMED', 'DISCARDED'] },
    }
    if (filters.zoneId) where.zoneId = filters.zoneId
    if (filters.q) where.name = { contains: filters.q, mode: 'insensitive' }
    if (filters.expiringSoon) {
      where.expiryDate = { lte: new Date(Date.now() + 7 * 86400000), gte: now }
    }
    if (filters.expired) {
      where.expiryDate = { lt: now }
    }
    if (filters.cursor) {
      where.id = { gt: filters.cursor }
    }

    const items = await prisma.item.findMany({
      where,
      include: { zone: { select: { id: true, name: true, icon: true } } },
      orderBy: { [filters.sort]: filters.order },
      take: filters.limit + 1,
    })

    const hasMore = items.length > filters.limit
    const data = items.slice(0, filters.limit).map(i => ({
      ...i,
      quantity: Number(i.quantity),
      price: i.price ? Number(i.price) : undefined,
      daysUntilExpiry: daysUntilExpiry(i.expiryDate),
    }))

    return reply.send({
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    })
  })

  // POST /v1/items
  app.post('/items', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const body = CreateItemBody.parse(req.body)

    const item = await prisma.item.create({
      data: {
        householdId,
        addedBy: userId,
        name: body.name,
        barcode: body.barcode,
        epc: body.epc,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
        openedAt: body.openedAt ? new Date(body.openedAt) : undefined,
        paoMonths: body.paoMonths,
        quantity: body.quantity,
        unit: body.unit,
        zoneId: body.zoneId,
        price: body.price,
        allergens: body.allergens,
        notes: body.notes,
      },
      include: { zone: { select: { id: true, name: true, icon: true } } },
    })

    // Vincular tag si se proporciona
    if (body.tagId) {
      await prisma.tag.update({
        where: { id: body.tagId },
        data: { itemId: item.id, householdId, status: 'ACTIVE' },
      })
    }

    // Registrar movimiento
    await prisma.movement.create({
      data: { itemId: item.id, action: 'ITEM_ADDED', performedBy: userId, toZoneId: body.zoneId },
    })

    return reply.status(201).send({ data: { ...item, quantity: Number(item.quantity), daysUntilExpiry: daysUntilExpiry(item.expiryDate) } })
  })

  // GET /v1/items/:id
  app.get('/items/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { id } = req.params as { id: string }

    const item = await prisma.item.findFirst({
      where: { id, householdId },
      include: {
        zone: true,
        tags: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!item) return reply.status(404).send({ error: 'Producto no encontrado', code: 'NOT_FOUND' })

    return reply.send({ data: { ...item, quantity: Number(item.quantity), daysUntilExpiry: daysUntilExpiry(item.expiryDate) } })
  })

  // PUT /v1/items/:id
  app.put('/items/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { id } = req.params as { id: string }
    const body = CreateItemBody.partial().parse(req.body)

    const item = await prisma.item.findFirst({ where: { id, householdId } })
    if (!item) return reply.status(404).send({ error: 'Producto no encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...body,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
        openedAt: body.openedAt ? new Date(body.openedAt) : undefined,
      },
    })

    return reply.send({ data: { ...updated, quantity: Number(updated.quantity) } })
  })

  // PATCH /v1/items/:id/consume
  app.patch('/items/:id/consume', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { id } = req.params as { id: string }
    const { quantity } = (req.body as any) ?? {}

    const item = await prisma.item.findFirst({ where: { id, householdId } })
    if (!item) return reply.status(404).send({ error: 'Producto no encontrado', code: 'NOT_FOUND' })

    const currentQty = Number(item.quantity)
    const consumeQty = quantity ?? currentQty
    const newQty = currentQty - consumeQty

    const updated = await prisma.item.update({
      where: { id },
      data: {
        quantity: Math.max(0, newQty),
        status: newQty <= 0 ? 'CONSUMED' : 'OK',
      },
    })

    await prisma.movement.create({
      data: { itemId: id, action: 'ITEM_CONSUMED', performedBy: userId, metadata: { quantity: consumeQty } },
    })

    return reply.send({ data: { ...updated, quantity: Number(updated.quantity) } })
  })

  // PATCH /v1/items/:id/discard
  app.patch('/items/:id/discard', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { id } = req.params as { id: string }

    const item = await prisma.item.findFirst({ where: { id, householdId } })
    if (!item) return reply.status(404).send({ error: 'Producto no encontrado', code: 'NOT_FOUND' })

    await prisma.item.update({ where: { id }, data: { status: 'DISCARDED' } })
    await prisma.movement.create({
      data: { itemId: id, action: 'ITEM_DISCARDED', performedBy: userId },
    })

    return reply.status(204).send()
  })

  // PATCH /v1/items/:id/move
  app.patch('/items/:id/move', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { id } = req.params as { id: string }
    const { toZoneId } = req.body as { toZoneId: string }

    const item = await prisma.item.findFirst({ where: { id, householdId } })
    if (!item) return reply.status(404).send({ error: 'Producto no encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.item.update({ where: { id }, data: { zoneId: toZoneId } })
    await prisma.movement.create({
      data: { itemId: id, action: 'ITEM_MOVED', performedBy: userId, fromZoneId: item.zoneId ?? undefined, toZoneId },
    })

    return reply.send({ data: { ...updated, quantity: Number(updated.quantity) } })
  })

  // GET /v1/pantry/summary
  app.get('/pantry/summary', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const now = new Date()
    const in7days = new Date(Date.now() + 7 * 86400000)

    const [total, expiringSoon, expired, zones] = await Promise.all([
      prisma.item.count({ where: { householdId, status: { notIn: ['CONSUMED', 'DISCARDED'] } } }),
      prisma.item.count({ where: { householdId, status: { notIn: ['CONSUMED', 'DISCARDED'] }, expiryDate: { lte: in7days, gte: now } } }),
      prisma.item.count({ where: { householdId, status: { notIn: ['CONSUMED', 'DISCARDED'] }, expiryDate: { lt: now } } }),
      prisma.pantryZone.findMany({
        where: { householdId },
        include: { _count: { select: { items: { where: { status: { notIn: ['CONSUMED', 'DISCARDED'] } } } } } },
        orderBy: { position: 'asc' },
      }),
    ])

    return reply.send({ data: { total, expiringSoon, expired, zones: zones.map(z => ({ ...z, itemCount: z._count.items })) } })
  })
}
