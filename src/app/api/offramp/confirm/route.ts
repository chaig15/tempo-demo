import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { burnTokens, verifyTransferToTreasury } from '@/lib/tempo-server'
import { createTransfer } from '@/lib/stripe-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { withdrawalId, transferTxHash } = body

    // Validate input
    if (!withdrawalId || typeof withdrawalId !== 'string') {
      return NextResponse.json({ error: 'Invalid withdrawal ID' }, { status: 400 })
    }

    if (!transferTxHash || typeof transferTxHash !== 'string') {
      return NextResponse.json({ error: 'Invalid transfer transaction hash' }, { status: 400 })
    }

    // Find transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: withdrawalId },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (transaction.type !== 'offramp') {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    // Check if already processed (idempotency)
    if (transaction.status === 'completed' && transaction.burnTxHash) {
      return NextResponse.json({
        success: true,
        burnTxHash: transaction.burnTxHash,
        payoutStatus: transaction.payoutStatus,
        alreadyProcessed: true,
      })
    }

    // Update with transfer hash
    await prisma.transaction.update({
      where: { id: withdrawalId },
      data: {
        status: 'processing',
        transferTxHash,
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
        where: { id: withdrawalId },
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
        `offramp:${withdrawalId}`
      )

      // Get user's connected account for payout
      const connectedAccount = await prisma.connectedAccount.findUnique({
        where: { userAddress: transaction.userAddress },
      })

      const amountUsd = Number(transaction.amountUsd)
      let transferId: string | null = null
      let payoutStatus = 'queued'

      if (connectedAccount?.payoutsEnabled) {
        // Create Stripe transfer to user's connected account
        try {
          const transferResult = await createTransfer(
            amountUsd,
            connectedAccount.stripeAccountId,
            {
              userAddress: transaction.userAddress,
              withdrawalId,
              burnTxHash,
            }
          )
          transferId = transferResult.transferId
          payoutStatus = 'paid'
        } catch (transferError) {
          // Log but don't fail - the burn already happened
          console.error('Stripe transfer creation failed:', transferError)
          payoutStatus = 'failed'
        }
      } else {
        // No connected account - payout pending
        payoutStatus = 'pending_account'
      }

      // Update transaction as completed
      await prisma.transaction.update({
        where: { id: withdrawalId },
        data: {
          status: 'completed',
          burnTxHash,
          payoutStatus,
          payoutId: transferId,
        },
      })

      return NextResponse.json({
        success: true,
        burnTxHash,
        transferId,
        payoutStatus,
        needsAccountSetup: !connectedAccount?.payoutsEnabled,
      })
    } catch (burnError) {
      await prisma.transaction.update({
        where: { id: withdrawalId },
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
