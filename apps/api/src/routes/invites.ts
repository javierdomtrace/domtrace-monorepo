import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@domtrace/db'

export const inviteRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/invite/:token — validar token (público, sin auth)
  // Devuelve info del hogar si el token es válido
  app.get('/invite/:token', async (req, reply) => {
    const { token } = req.params as { token: string }

    const invite = await prisma.householdInvite.findUnique({
      where: { token },
      include: {
        household: {
          select: { id: true, name: true },
        },
      },
    })

    if (!invite) {
      return reply.status(404).send({ error: 'Invitación no encontrada', code: 'INVITE_NOT_FOUND' })
    }
    if (invite.usedAt) {
      return reply.status(409).send({ error: 'Esta invitación ya fue usada', code: 'INVITE_USED' })
    }
    if (invite.expiresAt < new Date()) {
      return reply.status(410).send({ error: 'Esta invitación ha caducado', code: 'INVITE_EXPIRED' })
    }

    return reply.send({
      data: {
        householdId: invite.householdId,
        householdName: invite.household.name,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      }
    })
  })

  // POST /v1/invite/:token/accept — aceptar invitación (requiere auth)
  app.post('/invite/:token/accept', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { token } = req.params as { token: string }

    const invite = await prisma.householdInvite.findUnique({
      where: { token },
      include: { household: { select: { id: true, name: true } } },
    })

    if (!invite) {
      return reply.status(404).send({ error: 'Invitación no encontrada', code: 'INVITE_NOT_FOUND' })
    }
    if (invite.usedAt) {
      return reply.status(409).send({ error: 'Esta invitación ya fue usada', code: 'INVITE_USED' })
    }
    if (invite.expiresAt < new Date()) {
      return reply.status(410).send({ error: 'Esta invitación ha caducado', code: 'INVITE_EXPIRED' })
    }

    // Comprobar que el email del usuario coincide con el de la invitación
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return reply.status(403).send({
        error: `Esta invitación es para ${invite.email}. Estás usando la cuenta ${user.email}.`,
        code: 'EMAIL_MISMATCH',
      })
    }

    // Comprobar si ya es miembro
    const alreadyMember = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: invite.householdId, userId } }
    })

    if (!alreadyMember) {
      await prisma.$transaction([
        // Añadir al hogar
        prisma.householdMember.create({
          data: { householdId: invite.householdId, userId, role: invite.role }
        }),
        // Establecer como hogar activo
        prisma.user.update({
          where: { id: userId },
          data: { activeHouseholdId: invite.householdId }
        }),
      ])
    }

    // Marcar invitación como usada
    await prisma.householdInvite.update({
      where: { token },
      data: { usedAt: new Date() }
    })

    return reply.send({
      data: {
        ok: true,
        householdId: invite.householdId,
        householdName: invite.household.name,
        alreadyMember: !!alreadyMember,
      }
    })
  })
}
