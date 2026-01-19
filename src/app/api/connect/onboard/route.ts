import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createConnectedAccount, createAccountLink } from '@/lib/stripe-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress } = body

    if (!userAddress || typeof userAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 })
    }

    // Check if user already has a connected account
    let connectedAccount = await prisma.connectedAccount.findUnique({
      where: { userAddress },
    })

    // If account exists but onboarding not complete, create new link
    if (connectedAccount && !connectedAccount.onboardingComplete) {
      const { url } = await createAccountLink(
        connectedAccount.stripeAccountId,
        `${request.nextUrl.origin}/api/connect/return?userAddress=${userAddress}`,
        `${request.nextUrl.origin}/api/connect/refresh?userAddress=${userAddress}`
      )

      return NextResponse.json({
        onboardingUrl: url,
        accountId: connectedAccount.stripeAccountId,
      })
    }

    // If account exists and onboarding is complete, no action needed
    if (connectedAccount && connectedAccount.onboardingComplete) {
      return NextResponse.json({
        message: 'Account already set up',
        accountId: connectedAccount.stripeAccountId,
        onboardingComplete: true,
      })
    }

    // Create new connected account
    const { accountId } = await createConnectedAccount(userAddress)

    // Save to database
    connectedAccount = await prisma.connectedAccount.create({
      data: {
        userAddress,
        stripeAccountId: accountId,
        onboardingComplete: false,
      },
    })

    // Create account link for onboarding
    const { url } = await createAccountLink(
      accountId,
      `${request.nextUrl.origin}/api/connect/return?userAddress=${userAddress}`,
      `${request.nextUrl.origin}/api/connect/refresh?userAddress=${userAddress}`
    )

    return NextResponse.json({
      onboardingUrl: url,
      accountId,
    })
  } catch (error) {
    console.error('Connect onboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
