import 'dotenv/config'
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
import { profileRoutes } from './routes/profile.js'
import { openfoodfactsRoutes } from './routes/openfoodfacts.js'
import { billingRoutes } from './routes/billing.js'
import { householdRoutes } from './routes/households.js'
import { supplementRoutes } from './routes/supplements.js'
import { medicationRoutes } from './routes/medications.js'
import { pharmacyRoutes } from './routes/pharmacies.js'
import { babiesRoutes } from './routes/babies.js'
import { babyFeedingsRoutes } from './routes/baby-feedings.js'
import { babyMeasurementsRoutes } from './routes/baby-measurements.js'
import { inviteRoutes } from './routes/invites.js'
import { ocrRoutes } from './routes/ocr.js'

const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' } })

// ── Plugins ──────────────────────────────────────────────────────────
await app.register(fastifyHelmet)
await app.register(fastifyCors, { origin: process.env.CORS_ORIGIN ?? '*' })
await app.register(fastifyRateLimit, { max: 200, timeWindow: '1 minute' })
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production' })

// ── Decorator authenticate ────────────────────────────────────────────
app.decorate('authenticate', async function (req: any, reply: any) {
  const header = req.headers.authorization ?? 'NINGUNO'
  console.log('[AUTH]', req.method, req.url, 'header:', header.substring(0, 40))
  try {
    await req.jwtVerify()
  } catch (e: any) {
    console.log('[AUTH] FALLO:', e.message)
    reply.status(401).send({ error: 'Token inválido o expirado', code: 'UNAUTHORIZED' })
  }
})

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
await app.register(profileRoutes, v1)
await app.register(openfoodfactsRoutes, v1)  // Open Food Facts proxy
await app.register(billingRoutes, v1)
await app.register(householdRoutes, v1)
await app.register(supplementRoutes, v1)
await app.register(medicationRoutes, v1)
await app.register(pharmacyRoutes, v1)
await app.register(babiesRoutes, v1)
await app.register(babyFeedingsRoutes, v1)
await app.register(babyMeasurementsRoutes, v1)
await app.register(inviteRoutes, v1)
await app.register(ocrRoutes, v1)        // OCR de etiquetas (Claude Vision: fecha + lote)

// ── Health check ─────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// ── Start ─────────────────────────────────────────────────────────────
try {
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
