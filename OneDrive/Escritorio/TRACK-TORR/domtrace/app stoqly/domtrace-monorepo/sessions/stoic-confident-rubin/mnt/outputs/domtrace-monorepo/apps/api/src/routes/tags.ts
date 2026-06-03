import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const RegisterTagBody = z.object({
  tagId: z.string(),           // UID del chip NFC: "04:AB:CD:EF"
  epc: z.string().optional(),  // EPC si viene de sistema logístico
  tagType: z.enum(['NTAG213', 'NTAG215', 'NTAG216', 'NTAG424DNA', 'SLIX', 'SLIX2', 'DUAL_CARRIER']),
  itemId: z.string().uuid().optional(),
  householdId: z.string().uuid().optional(),
  expedicionId: z.string().uuid().optional(),
})

export const tagRoutes: FastifyPluginAsync = async (app) => {

  // POST /v1/tags — registrar tag
  app.post('/tags', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const body = RegisterTagBody.parse(req.body)

    const existing = await prisma.tag.findUnique({ where: { id: body.tagId } })
    if (existing) return reply.status(409).send({ error: 'Tag ya registrado', code: 'TAG_EXISTS' })

    const tag = await prisma.tag.create({
      data: {
        id: body.tagId,
        epc: body.epc,
        tagType: body.tagType,
        itemId: body.itemId,
        householdId: body.householdId,
        expedicionId: body.expedicionId,
        status: body.itemId ? 'PENDING_WRITE' : 'UNREGISTERED',
      },
    })

    // URL que se grabará en el chip NFC
    const resolveUrl = `${process.env.ALBARAN_URL}/t/${body.tagId}`

    if (body.itemId) {
      await prisma.movement.create({
        data: { tagId: body.tagId, itemId: body.itemId, action: 'TAG_WRITTEN', performedBy: userId },
      })
    }

    return reply.status(201).send({ data: { ...tag, resolveUrl } })
  })

  // GET /v1/tags/resolve/:tagId — resolución por UID (llamada desde la app al escanear)
  app.get('/tags/resolve/:tagId', async (req, reply) => {
    const { tagId } = req.params as { tagId: string }

    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      include: {
        item: { include: { zone: true } },
        expedicion: true,
      },
    })

    if (!tag) {
      return reply.send({ data: { type: 'unregistered', tagId, resolveUrl: `${process.env.ALBARAN_URL}/t/${tagId}` } })
    }

    // Actualizar stats de escaneo
    await prisma.tag.update({
      where: { id: tagId },
      data: { lastScannedAt: new Date(), scanCount: { increment: 1 } },
    })

    if (tag.expedicion) {
      return reply.send({ data: { type: 'expedicion', expedicion: tag.expedicion, tagId } })
    }

    if (tag.item) {
      const daysUntilExpiry = tag.item.expiryDate
        ? Math.ceil((tag.item.expiryDate.getTime() - Date.now()) / 86400000)
        : undefined
      return reply.send({
        data: {
          type: 'item',
          item: { ...tag.item, quantity: Number(tag.item.quantity), daysUntilExpiry },
          tagId,
        },
      })
    }

    return reply.send({ data: { type: 'unregistered', tagId } })
  })

  // GET /v1/tags/resolve/epc/:epc — resolución por EPC (lectores UHF logísticos)
  app.get('/tags/resolve/epc/:epc', async (req, reply) => {
    const { epc } = req.params as { epc: string }
    const tag = await prisma.tag.findUnique({ where: { epc }, include: { expedicion: true, item: true } })
    if (!tag) return reply.status(404).send({ error: 'EPC no encontrado', code: 'NOT_FOUND' })
    return reply.send({ data: tag })
  })

  // PATCH /v1/tags/:id/confirm — confirmar escritura física en el chip
  app.patch('/tags/:id/confirm', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { writtenAt } = req.body as { writtenAt?: string }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        registeredAt: writtenAt ? new Date(writtenAt) : new Date(),
      },
    })

    return reply.send({ data: tag })
  })

  // PATCH /v1/tags/:id/unlink — desvincular tag de un item
  app.patch('/tags/:id/unlink', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const { reason, newItemId } = req.body as { reason?: string; newItemId?: string }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        itemId: newItemId ?? null,
        status: newItemId ? 'PENDING_WRITE' : 'REASSIGNING',
      },
    })

    await prisma.movement.create({
      data: { tagId: id, action: 'TAG_REASSIGNED', performedBy: userId, metadata: { reason, newItemId } },
    })

    return reply.send({ data: tag })
  })

  // GET /v1/tags/:id/history
  app.get('/tags/:id/history', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const movements = await prisma.movement.findMany({
      where: { tagId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ data: movements })
  })
}
