/**
 * Server-side Stripe client
 */

import Stripe from 'stripe'

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(secretKey)
}

/**
 * Create a PaymentIntent for on-ramp
 */
export async function createPaymentIntent(
  amountUsd: number,
  metadata: {
    userAddress: string
    transactionId: string
  }
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripeClient()

  // Convert to cents for Stripe
  const amountCents = Math.round(amountUsd * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      userAddress: metadata.userAddress,
      transactionId: metadata.transactionId,
      amountUsd: amountUsd.toString(),
    },
  })

  if (!paymentIntent.client_secret) {
    throw new Error('Failed to create payment intent')
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }
}

/**
 * Verify a PaymentIntent succeeded
 */
export async function verifyPaymentIntent(
  paymentIntentId: string
): Promise<{
  verified: boolean
  amount: number
  metadata: Record<string, string>
}> {
  const stripe = getStripeClient()

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  return {
    verified: paymentIntent.status === 'succeeded',
    amount: paymentIntent.amount / 100, // Convert from cents
    metadata: paymentIntent.metadata as Record<string, string>,
  }
}
