import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@domtrace/db'
import { getActiveHousehold } from '../lib/household.js'

const SUPERMARKETS = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'El Corte Inglés', 'Alcampo', 'Dia', 'Consum', 'Eroski', 'Otro']
const ALLERGENS = ['GLUTEN', 'LACTOSA', 'FRUTOS_SECOS', 'HUEVO', 'MARISCO', 'SOY', 'APIO', 'MOSTAZA', 'SESAMO', 'SULFITOS']
const ACCESSIBILITY_MODES = ['VOICE', 'VIBRATION', 'SILENT', 'COMBINED']

const UpdateProfileBody = z.object({
  name: z.string().min(1).optional(),
  assistantName: z.string().min(1).optional(),
  allergens: z.array(z.string()).optional(),
  accessibilityMode: z.enum(['VOICE', 'VIBRATION', 'SILENT', 'COMBINED']).optional(),
  humorEnabled: z.boolean().optional(),
  voiceSpeed: z.enum(['SLOW', 'NORMAL', 'FAST']).optional(),
  highContrast: z.boolean().optional(),
  codigoPostal: z.string().regex(/^\d{5}$/, 'Código postal inválido').optional(),
  categoriasActivas: z.array(z.string()).optional(),
  alergiasPersonalizadas: z.array(z.string()).optional(),
  textSize: z.enum(['NORMAL', 'LARGE', 'XLARGE']).optional(),
  reduceMotion: z.boolean().optional(),
  // Perfil nutricional
  pesoKg: z.number().positive().optional(),
  alturaCm: z.number().positive().optional(),
  edadAnos: z.number().int().positive().optional(),
  nivelActividad: z.enum(['SEDENTARIO', 'LIGERO', 'MODERADO', 'ACTIVO', 'MUY_ACTIVO']).optional(),
  objetivoNutricional: z.enum(['PERDER_PESO', 'MANTENER', 'GANAR_MUSCULO', 'DIETA_ESPECIFICA']).optional(),
  // Actividad física
  deporte: z.string().nullable().optional(),
  deporteNivel: z.enum(['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO', 'COMPETICION']).nullable().optional(),
  deporteDiasSemana: z.number().int().min(1).max(7).nullable().optional(),
})

const UpdateHouseholdBody = z.object({
  name: z.string().min(1).optional(),
  supermarket: z.string().optional(),
  direccionCalle: z.string().optional(),
  direccionPiso: z.string().optional(),
  direccionCodigoPostal: z.string().optional(),
  direccionCiudad: z.string().optional(),
  direccionNombre: z.string().optional(),
  direccionTelefono: z.string().optional(),
})

export const profileRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/profile — obtener perfil completo
  app.get('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

    // Hogar activo
    let activeHouseholdId: string | null = null
    try { activeHouseholdId = await getActiveHousehold(userId) } catch {}

    const member = activeHouseholdId ? await prisma.householdMember.findFirst({
      where: { userId, householdId: activeHouseholdId },
      include: { household: true },
    }) : null

    // Miembros del hogar activo
    const members = member ? await prisma.householdMember.findMany({
      where: { householdId: member.householdId },
      include: { user: { select: { id: true, name: true, email: true } } }
    }) : []

    return reply.send({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          assistantName: user.assistantName,
          allergens: user.allergens,
          accessibilityMode: user.accessibilityMode,
          humorEnabled: user.humorEnabled,
          voiceSpeed: user.voiceSpeed,
          highContrast: user.highContrast,
          textSize: user.textSize,
          reduceMotion: user.reduceMotion,
          codigoPostal: user.codigoPostal,
          categoriasActivas: user.categoriasActivas,
          alergiasPersonalizadas: user.alergiasPersonalizadas,
          subscriptionTier: user.subscriptionTier,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
          activeHouseholdId: user.activeHouseholdId,
          pesoKg: user.pesoKg,
          alturaCm: user.alturaCm,
          edadAnos: user.edadAnos,
          nivelActividad: user.nivelActividad,
          objetivoNutricional: user.objetivoNutricional,
          deporte: user.deporte,
          deporteNivel: user.deporteNivel,
          deporteDiasSemana: user.deporteDiasSemana,
        },
        household: member ? {
          id: member.household.id,
          name: member.household.name,
          supermarket: member.household.supermarket,
          direccionCalle: member.household.direccionCalle,
          direccionPiso: member.household.direccionPiso,
          direccionCodigoPostal: member.household.direccionCodigoPostal,
          direccionCiudad: member.household.direccionCiudad,
          direccionNombre: member.household.direccionNombre,
          direccionTelefono: member.household.direccionTelefono,
          role: member.role,
          members: members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role })),
        } : null,
        options: { supermarkets: SUPERMARKETS, allergens: ALLERGENS, accessibilityModes: ACCESSIBILITY_MODES }
      }
    })
  })

  // PUT /v1/profile — actualizar perfil de usuario
  app.put('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const body = UpdateProfileBody.parse(req.body)

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.assistantName && { assistantName: body.assistantName }),
        ...(body.allergens !== undefined && { allergens: body.allergens }),
        ...(body.accessibilityMode && { accessibilityMode: body.accessibilityMode }),
        ...(body.humorEnabled !== undefined && { humorEnabled: body.humorEnabled }),
        ...(body.voiceSpeed && { voiceSpeed: body.voiceSpeed }),
        ...(body.highContrast !== undefined && { highContrast: body.highContrast }),
        ...(body.codigoPostal !== undefined && { codigoPostal: body.codigoPostal }),
        ...(body.categoriasActivas !== undefined && { categoriasActivas: body.categoriasActivas }),
        ...(body.alergiasPersonalizadas !== undefined && { alergiasPersonalizadas: body.alergiasPersonalizadas }),
        ...(body.highContrast !== undefined && { highContrast: body.highContrast }),
        ...(body.textSize !== undefined && { textSize: body.textSize }),
        ...(body.reduceMotion !== undefined && { reduceMotion: body.reduceMotion }),
        // Perfil nutricional
        ...(body.pesoKg !== undefined && { pesoKg: body.pesoKg }),
        ...(body.alturaCm !== undefined && { alturaCm: body.alturaCm }),
        ...(body.edadAnos !== undefined && { edadAnos: body.edadAnos }),
        ...(body.nivelActividad !== undefined && { nivelActividad: body.nivelActividad }),
        ...(body.objetivoNutricional !== undefined && { objetivoNutricional: body.objetivoNutricional }),
        // Actividad física
        ...(body.deporte !== undefined && { deporte: body.deporte }),
        ...(body.deporteNivel !== undefined && { deporteNivel: body.deporteNivel }),
        ...(body.deporteDiasSemana !== undefined && { deporteDiasSemana: body.deporteDiasSemana }),
      }
    })

    return reply.send({ data: { ok: true, assistantName: user.assistantName } })
  })

  // PUT /v1/profile/household — actualizar datos del hogar
  app.put('/profile/household', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const body = UpdateHouseholdBody.parse(req.body)

    const activeHouseholdId = await getActiveHousehold(userId).catch(() => null)
    const member = await prisma.householdMember.findFirst({
      where: { userId, ...(activeHouseholdId ? { householdId: activeHouseholdId } : {}) }
    })
    if (!member) return reply.status(404).send({ error: 'Hogar no encontrado' })

    await prisma.household.update({
      where: { id: member.householdId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.supermarket !== undefined && { supermarket: body.supermarket }),
        ...(body.direccionCalle !== undefined && { direccionCalle: body.direccionCalle }),
        ...(body.direccionPiso !== undefined && { direccionPiso: body.direccionPiso }),
        ...(body.direccionCodigoPostal !== undefined && { direccionCodigoPostal: body.direccionCodigoPostal }),
        ...(body.direccionCiudad !== undefined && { direccionCiudad: body.direccionCiudad }),
        ...(body.direccionNombre !== undefined && { direccionNombre: body.direccionNombre }),
        ...(body.direccionTelefono !== undefined && { direccionTelefono: body.direccionTelefono }),
      }
    })

    return reply.send({ data: { ok: true } })
  })

  // POST /v1/profile/household/invite — invitar miembro al hogar por email (con token)
  app.post('/profile/household/invite', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { email } = req.body as { email: string }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ error: 'Email inválido' })
    }

    const activeHouseholdId = await getActiveHousehold(userId).catch(() => null)
    const member = await prisma.householdMember.findFirst({
      where: { userId, ...(activeHouseholdId ? { householdId: activeHouseholdId } : {}) },
      include: { household: true },
    })
    if (!member) return reply.status(404).send({ error: 'Hogar no encontrado' })

    // Comprobar si ya es miembro
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const alreadyMember = await prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId: member.householdId, userId: existingUser.id } }
      })
      if (alreadyMember) return reply.status(409).send({ error: 'Ya es miembro del hogar', code: 'ALREADY_MEMBER' })
    }

    // Invalidar invitaciones previas pendientes para este email en este hogar
    await prisma.householdInvite.updateMany({
      where: { householdId: member.householdId, email, usedAt: null },
      data: { expiresAt: new Date() },
    })

    // Generar token y guardar invitación (expira en 7 días)
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000)

    await prisma.householdInvite.create({
      data: { householdId: member.householdId, invitedBy: userId, email, token, expiresAt }
    })

    const inviterName = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? 'Alguien'
    const householdName = member.household.name
    const panelUrl = process.env.PANEL_URL ?? 'http://localhost:5173'
    const inviteUrl = `${panelUrl}/invite/${token}`

    // Enviar email via Resend
    if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_...')) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Stoqly <noreply@stoqly.app>',
            to: email,
            subject: `${inviterName} te invita a unirte a "${householdName}" en Stoqly`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#14b8a6">Te han invitado a Stoqly</h2>
                <p><strong>${inviterName}</strong> te invita a unirte al hogar <strong>"${householdName}"</strong> en Stoqly.</p>
                <p>Stoqly es el asistente inteligente para gestionar tu hogar: despensa, suplementos, medicamentos, bebés y mucho más.</p>
                <p style="margin:24px 0">
                  <a href="${inviteUrl}" style="background:#14b8a6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold">
                    Aceptar invitación
                  </a>
                </p>
                <p style="color:#888;font-size:13px">Este enlace expira en 7 días. Si no conoces a esta persona, ignora este email.</p>
              </div>
            `,
          }),
        })
      } catch { /* no bloquear si Resend falla */ }
    }

    app.log.info(`[INVITE] ${email} → hogar ${member.householdId} | ${inviteUrl}`)
    return reply.send({ data: { ok: true, inviteUrl } })
  })

  // DELETE /v1/profile/household/member/:memberId — eliminar miembro
  app.delete('/profile/household/member/:memberId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { memberId } = req.params as { memberId: string }

    const activeHouseholdId = await getActiveHousehold(userId).catch(() => null)
    const member = await prisma.householdMember.findFirst({
      where: { userId, ...(activeHouseholdId ? { householdId: activeHouseholdId } : {}) }
    })
    if (!member) return reply.status(404).send({ error: 'Hogar no encontrado' })
    if (memberId === userId) return reply.status(400).send({ error: 'No puedes eliminarte a ti mismo' })

    await prisma.householdMember.delete({
      where: { householdId_userId: { householdId: member.householdId, userId: memberId } }
    })

    return reply.status(204).send()
  })
}
