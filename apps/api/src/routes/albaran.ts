import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'

const ConfirmBody = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  deviceId: z.string().optional(),
})

const IncidenciaBody = z.object({
  tipo: z.enum(['PRODUCTO_DANADO', 'CANTIDAD_INCORRECTA', 'PRODUCTO_INCORRECTO', 'OTRO']),
  descripcion: z.string(),
  imageUrl: z.string().url().optional(),
})

export const albaranRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/albaran/:epc — datos del albarán (acceso público, sin auth)
  // Esta URL se abre al escanear el tag NFC sin tener la app instalada
  app.get('/albaran/:epc', async (req, reply) => {
    const { epc } = req.params as { epc: string }

    const expedicion = await prisma.expedicion.findUnique({
      where: { epc },
    })

    if (!expedicion) return reply.status(404).send({ error: 'Albarán no encontrado', code: 'NOT_FOUND' })

    // Registrar apertura del albarán
    await prisma.movement.create({
      data: {
        expedicionId: expedicion.id,
        action: 'ALBARAN_OPENED',
        performedBy: 'anonymous',
        metadata: { epc },
      },
    })

    return reply.send({
      data: {
        epc: expedicion.epc,
        productoNombre: expedicion.productoNombre,
        productoRef: expedicion.productoRef,
        lote: expedicion.lote,
        estado: expedicion.estado,
        destinatarioTipo: expedicion.destinatarioTipo,
        fechaExpedicion: expedicion.fechaExpedicion,
        // No exponemos datos del remitente completos por privacidad
        remitenteId: expedicion.remitenteId,
        // URL de confirmación
        confirmUrl: `${process.env.BASE_URL}/v1/albaran/${epc}/confirm`,
      },
    })
  })

  // POST /v1/albaran/:epc/confirm — confirmar recepción
  app.post('/albaran/:epc/confirm', async (req, reply) => {
    const { epc } = req.params as { epc: string }
    const body = ConfirmBody.parse(req.body)

    const expedicion = await prisma.expedicion.findUnique({ where: { epc } })
    if (!expedicion) return reply.status(404).send({ error: 'Expedición no encontrada', code: 'NOT_FOUND' })
    if (expedicion.estado === 'ENTREGADA') {
      return reply.status(409).send({ error: 'Ya confirmada anteriormente', code: 'ALREADY_CONFIRMED' })
    }

    // Actualizar estado de la expedición
    await prisma.expedicion.update({
      where: { epc },
      data: {
        estado: 'ENTREGADA',
        fechaEntrega: new Date(),
        latEntrega: body.lat,
        lngEntrega: body.lng,
      },
    })

    // Registro inmutable del evento
    await prisma.movement.create({
      data: {
        expedicionId: expedicion.id,
        action: 'ALBARAN_CONFIRMED',
        performedBy: body.deviceId ?? 'anonymous',
        metadata: { lat: body.lat, lng: body.lng },
      },
    })

    // Si el destinatario es CONSUMER → crear item automáticamente en su despensa
    if (expedicion.destinatarioTipo === 'CONSUMER' && expedicion.destinatarioRef) {
      const user = await prisma.user.findUnique({ where: { email: expedicion.destinatarioRef } })
      if (user) {
        const member = await prisma.householdMember.findFirst({ where: { userId: user.id } })
        if (member) {
          await prisma.item.create({
            data: {
              householdId: member.householdId,
              addedBy: 'albaran',
              name: expedicion.productoNombre,
              epc: expedicion.epc,
            },
          })
        }
      }
    }

    return reply.send({ data: { confirmed: true, estado: 'ENTREGADA' } })
  })

  // POST /v1/albaran/:epc/incidencia
  app.post('/albaran/:epc/incidencia', async (req, reply) => {
    const { epc } = req.params as { epc: string }
    const body = IncidenciaBody.parse(req.body)

    const expedicion = await prisma.expedicion.findUnique({ where: { epc } })
    if (!expedicion) return reply.status(404).send({ error: 'Expedición no encontrada', code: 'NOT_FOUND' })

    await prisma.expedicion.update({ where: { epc }, data: { estado: 'INCIDENCIA' } })

    await prisma.movement.create({
      data: {
        expedicionId: expedicion.id,
        action: 'INCIDENCIA_REPORTED',
        performedBy: 'anonymous',
        metadata: { tipo: body.tipo, descripcion: body.descripcion, imageUrl: body.imageUrl },
      },
    })

    return reply.send({ data: { reported: true } })
  })

  // GET /v1/albaran/:epc/trazabilidad — historial completo del EPC
  app.get('/albaran/:epc/trazabilidad', async (req, reply) => {
    const { epc } = req.params as { epc: string }

    const expedicion = await prisma.expedicion.findUnique({ where: { epc } })
    if (!expedicion) return reply.status(404).send({ error: 'EPC no encontrado', code: 'NOT_FOUND' })

    const movements = await prisma.movement.findMany({
      where: { expedicionId: expedicion.id },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({
      data: {
        expedicion,
        trazabilidad: movements.map(m => ({
          accion: m.action,
          fecha: m.createdAt,
          metadata: m.metadata,
        })),
      },
    })
  })
}
