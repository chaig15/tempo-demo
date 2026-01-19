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

/**
 * Create a Stripe Connected Account (Express) for a user
 */
export async function createConnectedAccount(
  userAddress: string
): Promise<{ accountId: string }> {
  const stripe = getStripeClient()

  const account = await stripe.accounts.create({
    type: 'express',
    metadata: {
      userAddress,
    },
    capabilities: {
      transfers: { requested: true },
    },
  })

  return {
    accountId: account.id,
  }
}

/**
 * Create an account link for onboarding
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  })

  return {
    url: accountLink.url,
  }
}

/**
 * Get connected account status
 */
export async function getConnectedAccountStatus(
  accountId: string
): Promise<{
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}> {
  const stripe = getStripeClient()

  const account = await stripe.accounts.retrieve(accountId)

  return {
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  }
}

/**
 * Create a transfer to a connected account (for off-ramp)
 */
export async function createTransfer(
  amountUsd: number,
  destinationAccountId: string,
  metadata: {
    userAddress: string
    withdrawalId: string
    burnTxHash: string
  }
): Promise<{ transferId: string }> {
  const stripe = getStripeClient()

  // Convert to cents for Stripe
  const amountCents = Math.round(amountUsd * 100)

  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: destinationAccountId,
    metadata: {
      userAddress: metadata.userAddress,
      withdrawalId: metadata.withdrawalId,
      burnTxHash: metadata.burnTxHash,
      type: 'offramp',
    },
  })

  return {
    transferId: transfer.id,
  }
}
