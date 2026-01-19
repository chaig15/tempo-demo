import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getConnectedAccountStatus } from '@/lib/stripe-server'

export async function GET(request: NextRequest) {
  try {
    const userAddress = request.nextUrl.searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json({ error: 'Missing user address' }, { status: 400 })
    }

    // Get connected account from database
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { userAddress },
    })

    if (!connectedAccount) {
      return NextResponse.json({
        hasAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
      })
    }

    // If onboarding marked complete, return cached status
    if (connectedAccount.onboardingComplete && connectedAccount.payoutsEnabled) {
      return NextResponse.json({
        hasAccount: true,
        onboardingComplete: true,
        payoutsEnabled: true,
        accountId: connectedAccount.stripeAccountId,
      })
    }

    // Otherwise, check with Stripe for latest status
    const status = await getConnectedAccountStatus(connectedAccount.stripeAccountId)

    // Update database with latest status
    await prisma.connectedAccount.update({
      where: { userAddress },
      data: {
        onboardingComplete: status.detailsSubmitted,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
      },
    })

    return NextResponse.json({
      hasAccount: true,
      onboardingComplete: status.detailsSubmitted,
      payoutsEnabled: status.payoutsEnabled,
      accountId: connectedAccount.stripeAccountId,
    })
  } catch (error) {
    console.error('Connect status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
