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
  const access = app.jwt.sign({ id: userId }, { expiresIn: '15m' })
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
        user: { id: user.id, name: user.name, email: user.email, assistantName: user.assistantName },
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
    // Con JWT stateless, el logout se gestiona en cliente eliminando los tokens.
    // Para invalidación server-side, añadir el jti a una blocklist en Redis.
    return reply.status(204).send()
  })
}
