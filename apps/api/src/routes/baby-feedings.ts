import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const CreateFeedingBody = z.object({
  babyId:      z.string(),
  type:        z.enum(['PECHO_IZQUIERDO', 'PECHO_DERECHO', 'BIBERON', 'SOLIDOS']),
  amountMl:    z.number().positive().optional(),
  amountG:     z.number().positive().optional(),
  durationMin: z.number().int().positive().optional(),
  notes:       z.string().optional(),
  feedingAt:   z.string().optional(),
})

export const babyFeedingsRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/baby-feedings?babyId=xxx
  app.get('/baby-feedings', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { babyId, limit = '50' } = req.query as { babyId?: string; limit?: string }
    if (!babyId) return reply.status(400).send({ error: 'babyId requerido' })

    const feedings = await prisma.babyFeeding.findMany({
      where: { babyId },
      orderBy: { feedingAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 50, 200),
    })

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayFeedings = feedings.filter(f => new Date(f.feedingAt) >= today)

    const summary = {
      totalToday: todayFeedings.length,
      mlHoy: todayFeedings.reduce((s, f) => s + (f.amountMl ?? 0), 0),
      lastFeedingAt: feedings[0]?.feedingAt ?? null,
      minutesSinceLast: feedings[0]
        ? Math.round((Date.now() - new Date(feedings[0].feedingAt).getTime()) / 60000)
        : null,
    }

    return reply.send({ data: { feedings, summary } })
  })

  // POST /v1/baby-feedings
  app.post('/baby-feedings', { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = CreateFeedingBody.parse(req.body)

    const feeding = await prisma.babyFeeding.create({
      data: {
        babyId:      body.babyId,
        type:        body.type,
        amountMl:    body.amountMl ?? null,
        amountG:     body.amountG ?? null,
        durationMin: body.durationMin ?? null,
        notes:       body.notes ?? null,
        feedingAt:   body.feedingAt ? new Date(body.feedingAt) : new Date(),
      },
    })

    return reply.status(201).send({ data: feeding })
  })

  // DELETE /v1/baby-feedings/:id
  app.delete('/baby-feedings/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.babyFeeding.delete({ where: { id } })
    return reply.send({ data: { ok: true } })
  })
}
