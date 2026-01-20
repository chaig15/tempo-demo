import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPaymentIntent } from '@/lib/stripe-server'
import { mintTokens } from '@/lib/tempo-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { paymentIntentId, userAddress } = body

    // Validate input
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json({ error: 'Invalid payment intent ID' }, { status: 400 })
    }

    if (!userAddress || typeof userAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 })
    }

    // Find transaction by payment intent ID
    const transaction = await prisma.transaction.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if already processed (idempotency)
    if (transaction.status === 'completed' && transaction.mintTxHash) {
      return NextResponse.json({
        success: true,
        txHash: transaction.mintTxHash,
        amountMinted: transaction.amountToken,
        alreadyProcessed: true,
      })
    }

    // Already being processed by another request (webhook or duplicate)
    if (transaction.status === 'processing') {
      return NextResponse.json({
        success: true,
        message: 'Transaction is being processed',
        alreadyProcessing: true,
      })
    }

    // Verify user address matches
    if (transaction.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: 'User address mismatch' }, { status: 403 })
    }

    // Verify payment with Stripe
    const { verified, amount } = await verifyPaymentIntent(paymentIntentId)

    if (!verified) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          stripePaymentStatus: 'failed',
          errorMessage: 'Payment not verified',
        },
      })
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 })
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
      // Re-fetch to get current state
      const current = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      })
      if (current?.status === 'completed' && current.mintTxHash) {
        return NextResponse.json({
          success: true,
          txHash: current.mintTxHash,
          amountMinted: current.amountToken,
          alreadyProcessed: true,
        })
      }
      return NextResponse.json({
        success: true,
        message: 'Transaction is being processed by another request',
        alreadyProcessing: true,
      })
    }

    // Mint tokens to user
    try {
      const { txHash, amount: mintedAmount } = await mintTokens(
        userAddress as `0x${string}`,
        amount,
        `onramp:${transaction.id}`
      )

      // Update transaction as completed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'completed',
          mintTxHash: txHash,
          amountToken: mintedAmount,
        },
      })

      return NextResponse.json({
        success: true,
        txHash,
        amountMinted: mintedAmount,
      })
    } catch (mintError) {
      // Mint failed - record error but don't lose the payment
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          errorMessage: mintError instanceof Error ? mintError.message : 'Mint failed',
        },
      })

      console.error('Mint failed after successful payment:', mintError)
      return NextResponse.json(
        { error: 'Failed to mint tokens. Payment received. Contact support.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('On-ramp confirm error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
