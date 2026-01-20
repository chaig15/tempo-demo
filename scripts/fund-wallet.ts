/**
 * Fund Treasury Wallet Script
 *
 * Funds the treasury wallet with AlphaUSD from the Tempo testnet faucet.
 * Run with: npx tsx scripts/fund-wallet.ts
 */

import 'dotenv/config'
import { createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Abis } from 'viem/tempo'

const TEMPO_RPC_URL = process.env.NEXT_PUBLIC_TEMPO_RPC_URL ||
  'https://rpc.moderato.tempo.xyz'

const ALPHA_USD_ADDRESS = '0x20c0000000000000000000000000000000000001' as const

async function main() {
  console.log('=== Fund Treasury Wallet ===\n')

  const privateKey = process.env.ACME_TREASURY_PRIVATE_KEY
  if (!privateKey) {
    console.error('Error: ACME_TREASURY_PRIVATE_KEY not set in .env')
    console.log('Run: npx tsx scripts/generate-wallet.ts')
    process.exit(1)
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  console.log(`Treasury Address: ${account.address}`)

  const publicClient = createPublicClient({
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })

  // Check balance before
  console.log('\nChecking current balance...')
  const balanceBefore = await publicClient.readContract({
    address: ALPHA_USD_ADDRESS,
    abi: Abis.tip20,
    functionName: 'balanceOf',
    args: [account.address],
  }).catch(() => 0n)

  console.log(`Current AlphaUSD: $${(Number(balanceBefore) / 1e6).toFixed(2)}`)

  // Call faucet via RPC
  console.log('\nCalling Tempo testnet faucet...')

  try {
    const result = await publicClient.request({
      // @ts-expect-error - Custom RPC method
      method: 'tempo_fundAddress',
      params: [account.address],
    })

    console.log('Faucet response:', result)
    console.log('\n✅ Faucet called successfully!')

    // Wait a moment then check balance
    console.log('\nWaiting for transaction to confirm...')
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const balanceAfter = await publicClient.readContract({
      address: ALPHA_USD_ADDRESS,
      abi: Abis.tip20,
      functionName: 'balanceOf',
      args: [account.address],
    })

    console.log(`New AlphaUSD Balance: $${(Number(balanceAfter) / 1e6).toFixed(2)}`)
    console.log(`Added: $${((Number(balanceAfter) - Number(balanceBefore)) / 1e6).toFixed(2)}`)

  } catch (error) {
    console.error('\n❌ Faucet call failed:', error)
    console.log('\nYou may need to use the web faucet instead:')
    console.log('https://docs.tempo.xyz/quickstart/faucet')
    process.exit(1)
  }
}

main().catch(console.error)
