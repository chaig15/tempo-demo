/**
 * Server-side Tempo client for minting/burning tokens
 */

import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions, Abis } from 'viem/tempo'

const TEMPO_RPC_URL = process.env.NEXT_PUBLIC_TEMPO_RPC_URL ||
  'https://dreamy-northcutt:recursing-payne@rpc.testnet.tempo.xyz'

const ALPHA_USD_ADDRESS = '0x20c0000000000000000000000000000000000001' as const

function getTreasuryAccount() {
  const privateKey = process.env.ACME_TREASURY_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('ACME_TREASURY_PRIVATE_KEY not configured')
  }
  return privateKeyToAccount(privateKey as `0x${string}`)
}

function getAcmeUsdAddress(): `0x${string}` {
  const address = process.env.NEXT_PUBLIC_ACME_USD_ADDRESS
  if (!address) {
    throw new Error('NEXT_PUBLIC_ACME_USD_ADDRESS not configured')
  }
  return address as `0x${string}`
}

export function getPublicClient() {
  return createPublicClient({
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })
}

export function getTreasuryClient() {
  const account = getTreasuryAccount()

  return createWalletClient({
    account,
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })
}

/**
 * Mint AcmeUSD tokens to a user address
 */
export async function mintTokens(
  toAddress: `0x${string}`,
  amountUsd: number,
  memo?: string
): Promise<{ txHash: string; amount: string }> {
  const client = getTreasuryClient()
  const acmeUsdAddress = getAcmeUsdAddress()

  const amount = parseUnits(amountUsd.toString(), 6)

  const result = await Actions.token.mintSync(client, {
    token: acmeUsdAddress,
    to: toAddress,
    amount,
    memo: memo
      ? (`0x${Buffer.from(memo).toString('hex').padEnd(64, '0')}` as `0x${string}`)
      : undefined,
    feeToken: ALPHA_USD_ADDRESS,
  })

  return {
    txHash: result.receipt.transactionHash,
    amount: amount.toString(),
  }
}

/**
 * Burn AcmeUSD tokens from treasury
 */
export async function burnTokens(
  amount: bigint,
  memo?: string
): Promise<{ txHash: string }> {
  const client = getTreasuryClient()
  const acmeUsdAddress = getAcmeUsdAddress()

  const result = await Actions.token.burnSync(client, {
    token: acmeUsdAddress,
    amount,
    memo: memo
      ? (`0x${Buffer.from(memo).toString('hex').padEnd(64, '0')}` as `0x${string}`)
      : undefined,
    feeToken: ALPHA_USD_ADDRESS,
  })

  return {
    txHash: result.receipt.transactionHash,
  }
}

/**
 * Check treasury balance
 */
export async function getTreasuryBalance(): Promise<bigint> {
  const publicClient = getPublicClient()
  const account = getTreasuryAccount()
  const acmeUsdAddress = getAcmeUsdAddress()

  const balance = await publicClient.readContract({
    address: acmeUsdAddress,
    abi: Abis.tip20,
    functionName: 'balanceOf',
    args: [account.address],
  })

  return balance
}

/**
 * Verify a transfer to treasury
 */
export async function verifyTransferToTreasury(
  txHash: `0x${string}`,
  expectedAmount: bigint
): Promise<boolean> {
  const publicClient = getPublicClient()
  const account = getTreasuryAccount()
  const acmeUsdAddress = getAcmeUsdAddress()

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

    if (receipt.status !== 'success') {
      return false
    }

    // Check for Transfer event to treasury
    const transferLogs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === acmeUsdAddress.toLowerCase() &&
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event
    )

    for (const log of transferLogs) {
      const to = `0x${log.topics[2]?.slice(26)}`.toLowerCase()
      if (to === account.address.toLowerCase()) {
        // Found transfer to treasury
        const amount = BigInt(log.data)
        if (amount >= expectedAmount) {
          return true
        }
      }
    }

    return false
  } catch {
    return false
  }
}
