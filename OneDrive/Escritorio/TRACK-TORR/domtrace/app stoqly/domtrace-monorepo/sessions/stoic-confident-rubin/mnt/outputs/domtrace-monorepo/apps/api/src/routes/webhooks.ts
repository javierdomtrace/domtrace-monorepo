import type { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '@domtrace/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

const TIER_MAP: Record<string, string> = {
  price_hogar: 'HOGAR',
  price_experto: 'EXPERTO',
  price_enterprise: 'ENTERPRISE',
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
        const priceId = session.metadata?.priceId
        if (userId && priceId) {
          const tier = TIER_MAP[priceId] ?? 'FREE'
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
