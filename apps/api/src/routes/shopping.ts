import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold } from '../lib/household.js'

const AddItemBody = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default('u'),
  supermarket: z.string().optional(),
})

export const shoppingRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/shopping — lista de la compra pendiente
  app.get('/shopping', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)

    const items = await prisma.shoppingItem.findMany({
      where: { householdId, checked: false },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupar por supermercado
    const grouped = items.reduce((acc, item) => {
      const key = item.supermarket ?? 'Sin asignar'
      if (!acc[key]) acc[key] = []
      acc[key]!.push({ ...item, quantity: Number(item.quantity) })
      return acc
    }, {} as Record<string, any[]>)

    return reply.send({ data: { items: items.map(i => ({ ...i, quantity: Number(i.quantity) })), grouped } })
  })

  // POST /v1/shopping — añadir a lista
  app.post('/shopping', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const body = AddItemBody.parse(req.body)

    // Obtener supermercado del hogar si no se especifica
    let supermarket = body.supermarket
    if (!supermarket) {
      const household = await prisma.household.findUnique({ where: { id: householdId } })
      supermarket = household?.supermarket ?? undefined
    }

    const item = await prisma.shoppingItem.create({
      data: {
        householdId,
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        supermarket,
        addedBy: userId,
      },
    })

    return reply.status(201).send({ data: { ...item, quantity: Number(item.quantity) } })
  })

  // PATCH /v1/shopping/:id/check — marcar como comprado
  app.patch('/shopping/:id/check', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const updated = await prisma.shoppingItem.update({ where: { id }, data: { checked: true } })
    return reply.send({ data: { ...updated, quantity: Number(updated.quantity) } })
  })

  // DELETE /v1/shopping/:id
  app.delete('/shopping/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.shoppingItem.delete({ where: { id } })
    return reply.status(204).send()
  })

  // DELETE /v1/shopping/clear — limpiar lista completa (solo marcados)
  app.delete('/shopping/clear', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    await prisma.shoppingItem.deleteMany({ where: { householdId, checked: true } })
    return reply.status(204).send()
  })

  // DELETE /v1/shopping/deduplicate — eliminar duplicados (mantiene el más antiguo de cada nombre)
  app.delete('/shopping/deduplicate', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)

    const items = await prisma.shoppingItem.findMany({
      where: { householdId, checked: false },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupar por nombre normalizado — mantener el primero (más antiguo), borrar el resto
    const seen = new Map<string, boolean>()
    const toDelete: string[] = []

    for (const item of items) {
      const key = item.name.trim().toLowerCase()
      if (seen.has(key)) {
        toDelete.push(item.id)
      } else {
        seen.set(key, true)
      }
    }

    if (toDelete.length > 0) {
      await prisma.shoppingItem.deleteMany({ where: { id: { in: toDelete } } })
    }

    return reply.send({ data: { removed: toDelete.length } })
  })

  // DELETE /v1/shopping/by-name — eliminar todos los items con ese nombre (para Stoqly)
  app.delete('/shopping/by-name', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { name } = req.body as { name: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'name requerido' })

    const result = await prisma.shoppingItem.deleteMany({
      where: {
        householdId,
        name: { equals: name.trim(), mode: 'insensitive' },
        checked: false,
      }
    })
    return reply.send({ data: { removed: result.count } })
  })
}
