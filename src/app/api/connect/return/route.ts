import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getConnectedAccountStatus } from '@/lib/stripe-server'

export async function GET(request: NextRequest) {
  try {
    const userAddress = request.nextUrl.searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.redirect(new URL('/?error=missing_address', request.url))
    }

    // Get connected account from database
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { userAddress },
    })

    if (!connectedAccount) {
      return NextResponse.redirect(new URL('/?error=no_account', request.url))
    }

    // Check account status with Stripe
    const status = await getConnectedAccountStatus(connectedAccount.stripeAccountId)

    // Update database with status
    await prisma.connectedAccount.update({
      where: { userAddress },
      data: {
        onboardingComplete: status.detailsSubmitted,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
      },
    })

    // Redirect back to app with success
    if (status.detailsSubmitted) {
      return NextResponse.redirect(new URL('/?connect=success', request.url))
    } else {
      return NextResponse.redirect(new URL('/?connect=incomplete', request.url))
    }
  } catch (error) {
    console.error('Connect return error:', error)
    return NextResponse.redirect(new URL('/?error=connect_failed', request.url))
  }
}
