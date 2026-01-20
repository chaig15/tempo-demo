import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { formatUnits } from 'viem'
import { burnTokens, verifyTransferToTreasury } from '@/lib/tempo-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, amountAcmeUsd, transferTxHash } = body

    // Validate input
    if (!userAddress || typeof userAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid user address' }, { status: 400 })
    }

    if (!amountAcmeUsd || typeof amountAcmeUsd !== 'string') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!transferTxHash || typeof transferTxHash !== 'string') {
      return NextResponse.json({ error: 'Invalid transfer transaction hash' }, { status: 400 })
    }

    // Check for duplicate transaction (idempotency by txHash)
    const existingTx = await prisma.transaction.findFirst({
      where: { transferTxHash },
    })

    if (existingTx) {
      if (existingTx.status === 'completed' && existingTx.burnTxHash) {
        return NextResponse.json({
          success: true,
          burnTxHash: existingTx.burnTxHash,
          payoutStatus: existingTx.payoutStatus,
          alreadyProcessed: true,
        })
      }
      // If exists but not completed, let it continue processing
    }

    const amountBigInt = BigInt(amountAcmeUsd)
    const amountUsd = parseFloat(formatUnits(amountBigInt, 6))

    // Create transaction record now that user has signed
    const transaction = existingTx || await prisma.transaction.create({
      data: {
        type: 'offramp',
        status: 'processing',
        userAddress: userAddress.toLowerCase(),
        amountUsd,
        amountToken: amountAcmeUsd,
        transferTxHash,
        payoutStatus: 'pending',
      },
    })

    // Verify the transfer to treasury
    const expectedAmount = BigInt(transaction.amountToken)
    const verified = await verifyTransferToTreasury(
      transferTxHash as `0x${string}`,
      expectedAmount
    )

    if (!verified) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          errorMessage: 'Transfer verification failed',
        },
      })
      return NextResponse.json({ error: 'Transfer verification failed' }, { status: 400 })
    }

    // Burn the tokens
    try {
      const { txHash: burnTxHash } = await burnTokens(
        expectedAmount,
        `offramp:${transaction.id}`
      )

      // Mark payout as processing (simulated for demo)
      const payoutStatus = 'processing'

      // Update transaction as completed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'completed',
          burnTxHash,
          payoutStatus,
        },
      })

      return NextResponse.json({
        success: true,
        burnTxHash,
        payoutStatus,
      })
    } catch (burnError) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          errorMessage: burnError instanceof Error ? burnError.message : 'Burn failed',
        },
      })

      console.error('Burn failed after verified transfer:', burnError)
      return NextResponse.json(
        { error: 'Failed to burn tokens. Contact support.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Off-ramp confirm error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
