import type { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '@domtrace/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const PANEL_URL = process.env.PANEL_URL ?? 'http://localhost:5173'

// Precios por tier — configurar en Stripe Dashboard y poner IDs en .env
const PLAN_PRICES: Record<string, { priceId: string; name: string; amount: number }> = {
  EXPERTO: { priceId: process.env.STRIPE_PRICE_EXPERTO ?? '', name: 'Plan Experto',  amount: 999  },
  PREMIUM: { priceId: process.env.STRIPE_PRICE_PREMIUM ?? '', name: 'Plan Premium',  amount: 1999 },
}

export const billingRoutes: FastifyPluginAsync = async (app) => {

  // POST /v1/billing/checkout — crear sesión Stripe Checkout para upgrade de plan
  app.post('/billing/checkout', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { tier } = req.body as { tier: string }

    const plan = PLAN_PRICES[tier]
    if (!plan) return reply.status(400).send({ error: 'Plan no válido', code: 'INVALID_PLAN' })
    if (!plan.priceId) {
      return reply.status(500).send({ error: 'Precio de Stripe no configurado para este plan', code: 'STRIPE_NOT_CONFIGURED' })
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, stripeCustomerId: true, subscriptionTier: true },
    })

    if (user.subscriptionTier === tier) {
      return reply.status(400).send({ error: 'Ya tienes este plan activo', code: 'ALREADY_SUBSCRIBED' })
    }

    // Reusar o crear customer de Stripe
    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId } })
      customerId = customer.id
      await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${PANEL_URL}/plans?success=1&tier=${tier}`,
      cancel_url:  `${PANEL_URL}/plans?cancelled=1`,
      metadata: { userId, priceId: plan.priceId, tier },
      allow_promotion_codes: true,
      locale: 'es',
    })

    return reply.send({ data: { url: session.url } })
  })

  // GET /v1/billing/portal — redirigir al Stripe Customer Portal
  app.get('/billing/portal', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })

    if (!user.stripeCustomerId) {
      return reply.status(400).send({ error: 'No tienes ninguna suscripción activa', code: 'NO_SUBSCRIPTION' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${PANEL_URL}/plans`,
    })

    return reply.send({ data: { url: session.url } })
  })

  // GET /v1/billing/status — estado de suscripción actual
  app.get('/billing/status', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionTier: true, subscriptionExpiresAt: true, stripeCustomerId: true },
    })

    return reply.send({
      data: {
        tier: user.subscriptionTier,
        expiresAt: user.subscriptionExpiresAt,
        hasStripe: !!user.stripeCustomerId,
        plans: Object.entries(PLAN_PRICES).map(([key, val]) => ({
          tier: key,
          name: val.name,
          amount: val.amount,
          currency: 'eur',
        })),
      },
    })
  })
}
