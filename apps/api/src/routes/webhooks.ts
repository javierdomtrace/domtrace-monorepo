import type { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '@domtrace/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

// Mapa priceId → tier (se usan las env vars configuradas en Stripe Dashboard)
function getTierFromPriceId(priceId: string): string {
  const map: Record<string, string> = {}
  if (process.env.STRIPE_PRICE_HOGAR)      map[process.env.STRIPE_PRICE_HOGAR]      = 'HOGAR'
  if (process.env.STRIPE_PRICE_EXPERTO)    map[process.env.STRIPE_PRICE_EXPERTO]    = 'EXPERTO'
  if (process.env.STRIPE_PRICE_ENTERPRISE) map[process.env.STRIPE_PRICE_ENTERPRISE] = 'ENTERPRISE'
  return map[priceId] ?? 'FREE'
}

export const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  // POST /v1/webhooks/stripe — recibe eventos de Stripe (raw body requerido)
  app.post('/webhooks/stripe', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch {
      return reply.status(400).send({ error: 'Webhook signature inválida' })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        // Priorizar el tier que pasamos en metadata; fallback a priceId lookup
        const tier = session.metadata?.tier ?? getTierFromPriceId(session.metadata?.priceId ?? '')
        if (userId && tier !== 'FREE') {
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: tier as any,
              stripeCustomerId: session.customer as string,
              subscriptionExpiresAt: new Date(Date.now() + 365 * 86400000), // 1 año
            },
          })
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.user.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: { subscriptionTier: 'FREE', subscriptionExpiresAt: null },
        })
        break
      }
    }

    return reply.send({ received: true })
  })
}
