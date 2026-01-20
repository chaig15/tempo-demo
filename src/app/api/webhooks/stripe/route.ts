import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import prisma from '@/lib/db'
import { mintTokens } from '@/lib/tempo-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    console.log(`[Webhook] Payment succeeded: ${paymentIntent.id}`)

    try {
      // Find the transaction
      const transaction = await prisma.transaction.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id },
      })

      if (!transaction) {
        console.error(`[Webhook] Transaction not found for PI: ${paymentIntent.id}`)
        // Return 200 anyway - we don't want Stripe to retry
        return NextResponse.json({ received: true, warning: 'Transaction not found' })
      }

      // Check if already processed (idempotency)
      if (transaction.status === 'completed' && transaction.mintTxHash) {
        console.log(`[Webhook] Already processed: ${transaction.id}`)
        return NextResponse.json({ received: true, status: 'already_processed' })
      }

      // Already being processed by another request
      if (transaction.status === 'processing') {
        console.log(`[Webhook] Already processing: ${transaction.id}`)
        return NextResponse.json({ received: true, status: 'already_processing' })
      }

      // Atomic claim: only proceed if we successfully update from pending -> processing
      // This prevents race conditions between webhook and confirm endpoints
      const claimed = await prisma.transaction.updateMany({
        where: {
          id: transaction.id,
          status: 'pending', // Only claim if still pending
        },
        data: {
          status: 'processing',
          stripePaymentStatus: 'succeeded',
        },
      })

      // If no rows updated, another process already claimed it
      if (claimed.count === 0) {
        console.log(`[Webhook] Could not claim transaction: ${transaction.id} - already being processed`)
        return NextResponse.json({ received: true, status: 'already_claimed' })
      }

      // Mint tokens
      const amountUsd = paymentIntent.amount / 100
      const { txHash, amount: mintedAmount } = await mintTokens(
        transaction.userAddress as `0x${string}`,
        amountUsd,
        `onramp:${transaction.id}`
      )

      // Update as completed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'completed',
          mintTxHash: txHash,
          amountToken: mintedAmount,
        },
      })

      console.log(`[Webhook] Minted ${mintedAmount} to ${transaction.userAddress}, tx: ${txHash}`)

      return NextResponse.json({ received: true, status: 'minted', txHash })
    } catch (error) {
      console.error('[Webhook] Error processing payment:', error)

      // Try to record the error
      try {
        await prisma.transaction.updateMany({
          where: { stripePaymentIntentId: paymentIntent.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Webhook processing failed',
          },
        })
      } catch {
        // Ignore update errors
      }

      // Return 500 so Stripe will retry
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
  }

  // Handle other events we care about
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    await prisma.transaction.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'failed',
        stripePaymentStatus: 'failed',
        errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
      },
    })

    console.log(`[Webhook] Payment failed: ${paymentIntent.id}`)
  }

  return NextResponse.json({ received: true })
}
