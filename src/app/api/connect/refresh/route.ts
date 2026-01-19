import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { createAccountLink } from '@/lib/stripe-server'

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

    // Create new account link
    const { url } = await createAccountLink(
      connectedAccount.stripeAccountId,
      `${request.nextUrl.origin}/api/connect/return?userAddress=${userAddress}`,
      `${request.nextUrl.origin}/api/connect/refresh?userAddress=${userAddress}`
    )

    // Redirect to new onboarding URL
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Connect refresh error:', error)
    return NextResponse.redirect(new URL('/?error=connect_failed', request.url))
  }
}
