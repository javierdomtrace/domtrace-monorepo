import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const CreateMeasurementBody = z.object({
  babyId:     z.string(),
  weight:     z.number().positive().optional(),
  height:     z.number().positive().optional(),
  headCirc:   z.number().positive().optional(),
  measuredAt: z.string().optional(),
  notes:      z.string().optional(),
})

export const babyMeasurementsRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/baby-measurements?babyId=xxx
  app.get('/baby-measurements', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { babyId } = req.query as { babyId?: string }
    if (!babyId) return reply.status(400).send({ error: 'babyId requerido' })

    const measurements = await prisma.babyMeasurement.findMany({
      where: { babyId },
      orderBy: { measuredAt: 'desc' },
      take: 100,
    })

    return reply.send({ data: { measurements, latest: measurements[0] ?? null } })
  })

  // POST /v1/baby-measurements
  app.post('/baby-measurements', { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = CreateMeasurementBody.parse(req.body)

    const measurement = await prisma.babyMeasurement.create({
      data: {
        babyId:     body.babyId,
        weight:     body.weight ?? null,
        height:     body.height ?? null,
        headCirc:   body.headCirc ?? null,
        measuredAt: body.measuredAt ? new Date(body.measuredAt) : new Date(),
        notes:      body.notes ?? null,
      },
    })

    return reply.status(201).send({ data: measurement })
  })

  // DELETE /v1/baby-measurements/:id
  app.delete('/baby-measurements/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.babyMeasurement.delete({ where: { id } })
    return reply.send({ data: { ok: true } })
  })
}
