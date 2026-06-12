import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold } from '../lib/household.js'

const AddEventBody = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  startAt:     z.string().min(1),
  endAt:       z.string().optional(),
  allDay:      z.boolean().default(false),
  reminder:    z.boolean().default(true),
})

const UpdateEventBody = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startAt:     z.string().min(1).optional(),
  endAt:       z.string().nullable().optional(),
  allDay:      z.boolean().optional(),
  reminder:    z.boolean().optional(),
})

export const calendarRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/calendar
  // ?from=ISO&to=ISO → eventos cuyo inicio cae en ese rango (por defecto, próximos eventos)
  app.get('/calendar', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const { from, to } = req.query as { from?: string; to?: string }

    const where: any = { householdId }
    if (from || to) {
      where.startAt = {}
      if (from) where.startAt.gte = new Date(from)
      if (to)   where.startAt.lte = new Date(to)
    } else {
      // Por defecto: eventos desde hoy en adelante
      where.startAt = { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { startAt: 'asc' },
    })

    return reply.send({ data: { events } })
  })

  // POST /v1/calendar
  app.post('/calendar', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const householdId = await getActiveHousehold(userId)
    const body = AddEventBody.parse(req.body)

    const event = await prisma.calendarEvent.create({
      data: {
        householdId,
        createdBy: userId,
        title: body.title,
        description: body.description,
        startAt: new Date(body.startAt),
        endAt: body.endAt ? new Date(body.endAt) : undefined,
        allDay: body.allDay,
        reminder: body.reminder,
      },
    })

    return reply.status(201).send({ data: event })
  })

  // PATCH /v1/calendar/:id
  app.patch('/calendar/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = UpdateEventBody.parse(req.body)

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(body.title !== undefined       && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.startAt !== undefined      && { startAt: new Date(body.startAt) }),
        ...(body.endAt !== undefined        && { endAt: body.endAt ? new Date(body.endAt) : null }),
        ...(body.allDay !== undefined       && { allDay: body.allDay }),
        ...(body.reminder !== undefined     && { reminder: body.reminder }),
      },
    })

    return reply.send({ data: updated })
  })

  // DELETE /v1/calendar/:id
  app.delete('/calendar/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await prisma.calendarEvent.delete({ where: { id } })
    return reply.status(204).send()
  })
}
