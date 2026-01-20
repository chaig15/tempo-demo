import { NextRequest, NextResponse } from 'next/server'
import { formatUnits } from 'viem'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, amountAcmeUsd } = body

    // Validate input
    if (!userAddress || typeof userAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 })
    }

    if (!amountAcmeUsd || typeof amountAcmeUsd !== 'string') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const amountBigInt = BigInt(amountAcmeUsd)
    if (amountBigInt <= 0n) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    // Convert to USD (1:1)
    const amountUsd = parseFloat(formatUnits(amountBigInt, 6))

    if (amountUsd < 1) {
      return NextResponse.json({ error: 'Minimum withdrawal is $1' }, { status: 400 })
    }

    // Get treasury address from env
    const treasuryAddress = process.env.NEXT_PUBLIC_ACME_TREASURY_ADDRESS
    if (!treasuryAddress) {
      return NextResponse.json({ error: 'Treasury not configured' }, { status: 500 })
    }

    // Just validate and return treasury address - no DB record yet
    // Transaction is created in confirm after user signs
    return NextResponse.json({
      treasuryAddress,
      amountAcmeUsd,
      amountUsd,
    })
  } catch (error) {
    console.error('Off-ramp initiate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
