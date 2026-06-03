import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import { authRoutes } from './routes/auth.js'
import { itemRoutes } from './routes/items.js'
import { pantryRoutes } from './routes/pantry.js'
import { tagRoutes } from './routes/tags.js'
import { albaranRoutes } from './routes/albaran.js'
import { expedicionRoutes } from './routes/expediciones.js'
import { stoqlyRoutes } from './routes/stoqly.js'
import { shoppingRoutes } from './routes/shopping.js'
import { stripeWebhookRoutes } from './routes/webhooks.js'

const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' } })

// ── Plugins ──────────────────────────────────────────────────────────
await app.register(fastifyHelmet)
await app.register(fastifyCors, { origin: process.env.CORS_ORIGIN ?? '*' })
await app.register(fastifyRateLimit, { max: 200, timeWindow: '1 minute' })
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET! })

// ── Routes ───────────────────────────────────────────────────────────
const v1 = { prefix: '/v1' }
await app.register(authRoutes, v1)
await app.register(itemRoutes, v1)
await app.register(pantryRoutes, v1)
await app.register(tagRoutes, v1)
await app.register(albaranRoutes, v1)
await app.register(expedicionRoutes, v1)
await app.register(stoqlyRoutes, v1)       // Asistente Stoqly (IA + voz)
await app.register(shoppingRoutes, v1)
await app.register(stripeWebhookRoutes, v1)

// ── Health check ─────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// ── Start ─────────────────────────────────────────────────────────────
try {
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
