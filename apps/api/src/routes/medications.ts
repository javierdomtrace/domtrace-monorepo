import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold } from '../lib/household.js'

const CATEGORY_MEDICAMENTOS = 'MEDICAMENTOS'

const FRECUENCIA_OPTS = ['DIARIO', 'CADA_8H', 'CADA_12H', 'SEMANAL', 'SEGUN_NECESIDAD'] as const

const AddMedicationBody = z.object({
  name:           z.string().min(1),
  quantity:       z.number().positive().default(1),
  unit:           z.string().default('comp.'),
  dosisDesc:      z.string().optional(),
  frecuenciaToma: z.enum(FRECUENCIA_OPTS).optional(),
  notes:          z.string().optional(),
  barcode:        z.string().optional(),
  expiryDate:     z.string().optional(),
  babyId:         z.string().optional(),   // null = adulto, string = bebé
})

const UpdateMedicationBody = z.object({
  name:           z.string().min(1).optional(),
  quantity:       z.number().positive().optional(),
  unit:           z.string().optional(),
  dosisDesc:      z.string().nullable().optional(),
  frecuenciaToma: z.enum(FRECUENCIA_OPTS).nullable().optional(),
  notes:          z.string().nullable().optional(),
  barcode:        z.string().nullable().optional(),
  expiryDate:     z.string().nullable().optional(),
})

export const medicationRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/medications
  // ?babyId=xxx → medicamentos de ese bebé | sin babyId → medicamentos adulto (babyId NULL)
  app.get('/medications', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { babyId } = req.query as { babyId?: string }

    const items = await prisma.item.findMany({
      where: {
        householdId,
        categoryId: CATEGORY_MEDICAMENTOS,
        status: { not: 'DISCARDED' },
        babyId: babyId ? babyId : null,
      },
      orderBy: { name: 'asc' },
    })

    const now = new Date()
    const withMeta = items.map(item => {
      const qty = Number(item.quantity)
      const expiry = item.expiryDate ? new Date(item.expiryDate) : null
      const daysUntilExpiry = expiry
        ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
        : null
      return {
        ...item,
        quantity: qty,
        lowStock: qty <= 5,
        daysUntilExpiry,
        expiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= 60 && daysUntilExpiry >= 0,
        expired: daysUntilExpiry !== null && daysUntilExpiry < 0,
      }
    })

    const lowStockCount   = withMeta.filter(i => i.lowStock).length
    const expiringSoonCount = withMeta.filter(i => i.expiringSoon).length
    const expiredCount    = withMeta.filter(i => i.expired).length

    return reply.send({ data: { items: withMeta, lowStockCount, expiringSoonCount, expiredCount } })
  })

  // POST /v1/medications
  app.post('/medications', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const body = AddMedicationBody.parse(req.body)

    const item = await prisma.item.create({
      data: {
        householdId,
        addedBy: userId,
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        categoryId: CATEGORY_MEDICAMENTOS,
        dosisDesc: body.dosisDesc,
        frecuenciaToma: body.frecuenciaToma,
        notes: body.notes,
        ...(body.barcode    && { barcode: body.barcode }),
        ...(body.expiryDate && { expiryDate: new Date(body.expiryDate) }),
        ...(body.babyId     && { babyId: body.babyId }),
      },
    })

    return reply.status(201).send({ data: { ...item, quantity: Number(item.quantity) } })
  })

  // PATCH /v1/medications/:id
  app.patch('/medications/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = UpdateMedicationBody.parse(req.body)

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(body.name !== undefined           && { name: body.name }),
        ...(body.quantity !== undefined       && { quantity: body.quantity }),
        ...(body.unit !== undefined           && { unit: body.unit }),
        ...(body.dosisDesc !== undefined      && { dosisDesc: body.dosisDesc }),
        ...(body.frecuenciaToma !== undefined && { frecuenciaToma: body.frecuenciaToma }),
        ...(body.notes !== undefined          && { notes: body.notes }),
        ...(body.barcode !== undefined        && { barcode: body.barcode }),
        ...(body.expiryDate !== undefined     && {
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        }),
      },
    })

    return reply.send({ data: { ...updated, quantity: Number(updated.quantity) } })
  })

  // DELETE /v1/medications/:id — soft delete
  app.delete('/medications/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.item.update({ where: { id }, data: { status: 'DISCARDED' } })
    return reply.status(204).send()
  })
}
