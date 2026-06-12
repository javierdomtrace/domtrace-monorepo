import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold } from '../lib/household.js'

const CATEGORY_SUPLEMENTOS = 'SUPLEMENTOS'

const FRECUENCIA_OPTS = ['DIARIO', 'CADA_8H', 'CADA_12H', 'SEMANAL', 'SEGUN_NECESIDAD'] as const

const AddSupplementBody = z.object({
  name:           z.string().min(1),
  quantity:       z.number().positive().default(1),
  unit:           z.string().default('u'),
  dosisDesc:      z.string().optional(),
  frecuenciaToma: z.enum(FRECUENCIA_OPTS).optional(),
  notes:          z.string().optional(),
  stockMinimo:    z.number().int().positive().optional(),
  barcode:        z.string().optional(),
  babyId:         z.string().optional(),             // null = adulto, string = bebé
})

const UpdateSupplementBody = z.object({
  name:           z.string().min(1).optional(),
  quantity:       z.number().positive().optional(),
  unit:           z.string().optional(),
  dosisDesc:      z.string().nullable().optional(),
  frecuenciaToma: z.enum(FRECUENCIA_OPTS).nullable().optional(),
  notes:          z.string().nullable().optional(),
  stockMinimo:    z.number().int().positive().nullable().optional(),
})

export const supplementRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/supplements — lista de suplementos activos
  // ?babyId=xxx → suplementos de ese bebé | sin babyId → suplementos del adulto (babyId NULL)
  app.get('/supplements', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { babyId } = req.query as { babyId?: string }

    const items = await prisma.item.findMany({
      where: {
        householdId,
        categoryId: CATEGORY_SUPLEMENTOS,
        status: { not: 'DISCARDED' },
        babyId: babyId ? babyId : null,
      },
      orderBy: { name: 'asc' },
    })

    // Calcular alertas de restock
    const withAlerts = items.map(item => {
      const qty = Number(item.quantity)
      const stockMin = (item as any).stockMinimo ?? 5
      const lowStock = qty <= stockMin
      return {
        ...item,
        quantity: qty,
        lowStock,
      }
    })

    const lowStockCount = withAlerts.filter(i => i.lowStock).length

    return reply.send({ data: { items: withAlerts, lowStockCount } })
  })

  // POST /v1/supplements — añadir suplemento
  app.post('/supplements', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const body = AddSupplementBody.parse(req.body)

    const item = await prisma.item.create({
      data: {
        householdId,
        addedBy: userId,
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        categoryId: CATEGORY_SUPLEMENTOS,
        dosisDesc: body.dosisDesc,
        frecuenciaToma: body.frecuenciaToma,
        notes: body.notes,
        ...(body.barcode && { barcode: body.barcode }),
        ...(body.babyId  && { babyId: body.babyId }),
      },
    })

    return reply.status(201).send({ data: { ...item, quantity: Number(item.quantity) } })
  })

  // PATCH /v1/supplements/:id — actualizar (incluyendo consumo: restar qty)
  app.patch('/supplements/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = UpdateSupplementBody.parse(req.body)

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(body.name !== undefined        && { name: body.name }),
        ...(body.quantity !== undefined    && { quantity: body.quantity }),
        ...(body.unit !== undefined        && { unit: body.unit }),
        ...(body.dosisDesc !== undefined   && { dosisDesc: body.dosisDesc }),
        ...(body.frecuenciaToma !== undefined && { frecuenciaToma: body.frecuenciaToma }),
        ...(body.notes !== undefined       && { notes: body.notes }),
      },
    })

    return reply.send({ data: { ...updated, quantity: Number(updated.quantity) } })
  })

  // DELETE /v1/supplements/:id — descartar suplemento
  app.delete('/supplements/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.item.update({ where: { id }, data: { status: 'DISCARDED' } })
    return reply.status(204).send()
  })
}
