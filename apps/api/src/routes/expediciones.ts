import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const CreateExpedicionBody = z.object({
  epc: z.string(),
  remitenteId: z.string(),
  destinatarioTipo: z.enum(['CONSUMER', 'ENTERPRISE', 'WAREHOUSE']),
  destinatarioRef: z.string().optional(),
  productoNombre: z.string(),
  productoRef: z.string().optional(),
  lote: z.string().optional(),
  numeroPedido: z.string().optional(),
  centroCosto: z.string().optional(),
  departamento: z.string().optional(),
})

export const expedicionRoutes: FastifyPluginAsync = async (app) => {

  // POST /v1/expediciones
  app.post('/expediciones', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateExpedicionBody.parse(req.body)

    const existing = await prisma.expedicion.findUnique({ where: { epc: body.epc } })
    if (existing) return reply.status(409).send({ error: 'EPC ya registrado', code: 'EPC_EXISTS' })

    const expedicion = await prisma.expedicion.create({ data: body })

    await prisma.movement.create({
      data: { expedicionId: expedicion.id, action: 'EXPEDICION_CREATED', performedBy: body.remitenteId },
    })

    return reply.status(201).send({ data: expedicion })
  })

  // GET /v1/expediciones
  app.get('/expediciones', { preHandler: [app.authenticate] }, async (req, reply) => {
    const q = req.query as any
    const where: any = {}
    if (q.estado) where.estado = q.estado
    if (q.remitenteId) where.remitenteId = q.remitenteId
    if (q.destinatarioTipo) where.destinatarioTipo = q.destinatarioTipo
    if (q.desde) where.fechaExpedicion = { gte: new Date(q.desde) }
    if (q.hasta) where.fechaExpedicion = { ...where.fechaExpedicion, lte: new Date(q.hasta) }

    const expediciones = await prisma.expedicion.findMany({
      where,
      orderBy: { fechaExpedicion: 'desc' },
      take: 50,
    })

    return reply.send({ data: expediciones })
  })

  // GET /v1/expediciones/:id
  app.get('/expediciones/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const expedicion = await prisma.expedicion.findUnique({ where: { id } })
    if (!expedicion) return reply.status(404).send({ error: 'No encontrada', code: 'NOT_FOUND' })

    const movements = await prisma.movement.findMany({
      where: { expedicionId: id },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ data: { expedicion, trazabilidad: movements } })
  })

  // PATCH /v1/expediciones/:id/transito — lectura UHF en punto de tránsito
  app.patch('/expediciones/:id/transito', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { puntoLecturaId, lat, lng } = req.body as any

    await prisma.expedicion.update({ where: { id }, data: { estado: 'EN_TRANSITO' } })
    await prisma.movement.create({
      data: {
        expedicionId: id,
        action: 'EXPEDICION_TRANSIT',
        performedBy: puntoLecturaId ?? 'rfid-reader',
        metadata: { puntoLecturaId, lat, lng },
      },
    })

    return reply.send({ data: { estado: 'EN_TRANSITO' } })
  })

  // GET /v1/expediciones/dashboard
  app.get('/expediciones/dashboard', { preHandler: [app.authenticate] }, async (req, reply) => {
    const [activas, entregadas, incidencias] = await Promise.all([
      prisma.expedicion.count({ where: { estado: 'EN_TRANSITO' } }),
      prisma.expedicion.count({ where: { estado: 'ENTREGADA' } }),
      prisma.expedicion.count({ where: { estado: 'INCIDENCIA' } }),
    ])

    const recientes = await prisma.expedicion.findMany({
      orderBy: { fechaExpedicion: 'desc' },
      take: 10,
    })

    return reply.send({ data: { activas, entregadas, incidencias, recientes } })
  })
}
