import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createPaymentIntent } from '@/lib/stripe-server'
import { parseUnits } from 'viem'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, amountUsd } = body

    // Validate input
    if (!userAddress || typeof userAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 })
    }

    if (!amountUsd || typeof amountUsd !== 'number' || amountUsd <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (amountUsd < 1) {
      return NextResponse.json({ error: 'Minimum amount is $1' }, { status: 400 })
    }

    if (amountUsd > 10000) {
      return NextResponse.json({ error: 'Maximum amount is $10,000' }, { status: 400 })
    }

    // Calculate token amount (1:1 USD to AcmeUSD)
    const amountToken = parseUnits(amountUsd.toString(), 6).toString()

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        type: 'onramp',
        status: 'pending',
        userAddress: userAddress.toLowerCase(),
        amountUsd,
        amountToken,
      },
    })

    // Create Stripe PaymentIntent
    const { clientSecret, paymentIntentId } = await createPaymentIntent(amountUsd, {
      userAddress: userAddress.toLowerCase(),
      transactionId: transaction.id,
    })

    // Update transaction with Stripe info
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        stripePaymentIntentId: paymentIntentId,
        stripePaymentStatus: 'requires_payment_method',
      },
    })

    return NextResponse.json({
      transactionId: transaction.id,
      clientSecret,
      paymentIntentId,
      amountUsd,
      amountToken,
    })
  } catch (error) {
    console.error('On-ramp initiate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
