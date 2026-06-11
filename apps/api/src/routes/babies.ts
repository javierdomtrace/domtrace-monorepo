import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold } from '../lib/household.js'

const CreateBabyBody = z.object({
  name:      z.string().min(1),
  birthDate: z.string(),
  gender:    z.enum(['M', 'F']).optional(),
  photoUrl:  z.string().url().optional(),
})

const UpdateBabyBody = CreateBabyBody.partial()

export const babiesRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/babies
  app.get('/babies', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    if (!householdId) return reply.status(404).send({ error: 'Sin hogar' })

    const babies = await prisma.baby.findMany({
      where: { householdId },
      orderBy: { birthDate: 'asc' },
    })

    const now = new Date()
    const withAge = babies.map(b => {
      const birth = new Date(b.birthDate)
      const months =
        (now.getFullYear() - birth.getFullYear()) * 12 +
        (now.getMonth() - birth.getMonth())
      return { ...b, ageMonths: Math.max(0, months) }
    })

    return reply.send({ data: withAge })
  })

  // POST /v1/babies
  app.post('/babies', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const body = CreateBabyBody.parse(req.body)
    const householdId = await getActiveHousehold(userId)
    if (!householdId) return reply.status(404).send({ error: 'Sin hogar' })

    const baby = await prisma.baby.create({
      data: {
        householdId,
        name:      body.name,
        birthDate: new Date(body.birthDate),
        gender:    body.gender ?? null,
        photoUrl:  body.photoUrl ?? null,
      },
    })

    return reply.status(201).send({ data: baby })
  })

  // PATCH /v1/babies/:id
  app.patch('/babies/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }
    const body = UpdateBabyBody.parse(req.body)

    const householdId = await getActiveHousehold(userId)
    const baby = await prisma.baby.findUnique({ where: { id } })
    if (!baby || baby.householdId !== householdId) return reply.status(404).send({ error: 'No encontrado' })

    const updated = await prisma.baby.update({
      where: { id },
      data: {
        ...(body.name      && { name: body.name }),
        ...(body.birthDate && { birthDate: new Date(body.birthDate) }),
        ...(body.gender !== undefined && { gender: body.gender ?? null }),
        ...(body.photoUrl  && { photoUrl: body.photoUrl }),
      },
    })

    return reply.send({ data: updated })
  })

  // DELETE /v1/babies/:id
  app.delete('/babies/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { id } = req.params as { id: string }

    const householdId = await getActiveHousehold(userId)
    const baby = await prisma.baby.findUnique({ where: { id } })
    if (!baby || baby.householdId !== householdId) return reply.status(404).send({ error: 'No encontrado' })

    await prisma.baby.delete({ where: { id } })
    return reply.send({ data: { ok: true } })
  })
}
