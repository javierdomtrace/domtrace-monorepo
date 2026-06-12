import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@domtrace/db'

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  locale: z.string().default('es-ES'),
})

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
})

function signTokens(app: any, userId: string) {
  const access = app.jwt.sign({ id: userId }, { expiresIn: process.env.NODE_ENV === 'production' ? '15m' : '24h' })
  const refresh = app.jwt.sign({ id: userId, type: 'refresh' }, {
    secret: process.env.REFRESH_SECRET,
    expiresIn: '30d',
  })
  return { accessToken: access, refreshToken: refresh }
}

export const authRoutes: FastifyPluginAsync = async (app) => {

  // POST /v1/auth/register
  app.post('/auth/register', async (req, reply) => {
    const body = RegisterBody.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return reply.status(409).send({ error: 'Email ya registrado', code: 'EMAIL_EXISTS' })

    const passwordHash = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, name: body.name, locale: body.locale },
    })

    // Crear hogar por defecto
    const household = await prisma.household.create({
      data: { name: `Casa de ${body.name.split(' ')[0]}`, ownerId: user.id, type: 'HOME' },
    })
    await prisma.householdMember.create({
      data: { householdId: household.id, userId: user.id, role: 'OWNER' },
    })

    // Zonas por defecto
    await prisma.pantryZone.createMany({
      data: [
        { householdId: household.id, name: 'Nevera', icon: '🧊', temperatureType: 'COLD', position: 0 },
        { householdId: household.id, name: 'Despensa', icon: '🥫', temperatureType: 'AMBIENT', position: 1 },
        { householdId: household.id, name: 'Congelador', icon: '❄️', temperatureType: 'FROZEN', position: 2 },
      ],
    })

    const tokens = signTokens(app, user.id)
    return reply.status(201).send({
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        household: { id: household.id, name: household.name },
        tokens,
      },
    })
  })

  // POST /v1/auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = LoginBody.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS' })
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS' })

    const tokens = signTokens(app, user.id)
    return reply.send({
      data: {
        user: { id: user.id, name: user.name, email: user.email, assistantName: user.assistantName, subscriptionTier: user.subscriptionTier, activeHouseholdId: user.activeHouseholdId },
        tokens,
      },
    })
  })

  // POST /v1/auth/refresh
  app.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    try {
      const payload = app.jwt.verify(refreshToken, { secret: process.env.REFRESH_SECRET }) as { id: string }
      const tokens = signTokens(app, payload.id)
      return reply.send({ data: { tokens } })
    } catch {
      return reply.status(401).send({ error: 'Refresh token inválido', code: 'INVALID_REFRESH' })
    }
  })

  // POST /v1/auth/logout
  app.post('/auth/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    return reply.status(204).send()
  })

  // POST /v1/auth/change-password — cambiar contraseña autenticado
  app.post('/auth/change-password', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
    if (!newPassword || newPassword.length < 8) {
      return reply.status(400).send({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash ?? '')
      if (!valid) return reply.status(401).send({ error: 'Contraseña actual incorrecta' })
    }
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return reply.send({ data: { ok: true } })
  })

  // POST /v1/auth/forgot-password — enviar email de recuperación
  app.post('/auth/forgot-password', async (req, reply) => {
    const { email } = req.body as { email: string }
    if (!email) return reply.status(400).send({ error: 'Email requerido' })

    const user = await prisma.user.findUnique({ where: { email } })
    // Siempre responder OK para no revelar si el email existe
    if (!user) return reply.send({ data: { ok: true } })

    // Generar token de reset (válido 1 hora)
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 3600_000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expires },
    })

    const resetUrl = `${process.env.PANEL_URL}/reset-password?token=${token}`

    // Enviar email via Resend si está configurado
    if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_...')) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Stoqly <noreply@stoqly.app>',
            to: email,
            subject: 'Recupera tu contraseña de Stoqly',
            html: `
              <h2>Recuperar contraseña</h2>
              <p>Hola ${user.name},</p>
              <p>Haz clic en el siguiente enlace para restablecer tu contraseña. El enlace expira en 1 hora.</p>
              <p><a href="${resetUrl}" style="background:#14b8a6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Restablecer contraseña</a></p>
              <p>Si no solicitaste esto, ignora este email.</p>
            `,
          }),
        })
      } catch { /* no bloquear si Resend falla */ }
    }

    app.log.info(`[RESET] Token para ${email}: ${resetUrl}`)
    return reply.send({ data: { ok: true } })
  })

  // POST /v1/auth/reset-password — aplicar nueva contraseña con token
  app.post('/auth/reset-password', async (req, reply) => {
    const { token, newPassword } = req.body as { token: string; newPassword: string }
    if (!token || !newPassword || newPassword.length < 8) {
      return reply.status(400).send({ error: 'Token y contraseña (mín. 8 chars) requeridos' })
    }

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    })
    if (!user) return reply.status(400).send({ error: 'Token inválido o expirado' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    })

    const tokens = signTokens(app, user.id)
    return reply.send({ data: { ok: true, tokens } })
  })

  // POST /v1/auth/dev-reset — SOLO DESARROLLO: reset sin email (eliminar en producción)
  app.post('/auth/dev-reset', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') return reply.status(404).send()
    const { email, newPassword, secret } = req.body as { email: string; newPassword: string; secret: string }
    if (secret !== 'stoqly-dev-2024') return reply.status(403).send({ error: 'Forbidden' })
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const user = await prisma.user.update({ where: { email }, data: { passwordHash } })
    const tokens = signTokens(app, user.id)
    return reply.send({ data: { ok: true, email: user.email, tokens } })
  })
}
