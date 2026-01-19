/**
 * Deploy AcmeUSD Token Script
 *
 * This script deploys the AcmeUSD TIP-20 token to Tempo testnet.
 * Run with: npx tsx scripts/deploy-token.ts
 *
 * Prerequisites:
 * - ACME_TREASURY_PRIVATE_KEY set in .env
 * - Funded with AlphaUSD for gas fees (use faucet first)
 */

import 'dotenv/config'
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions, Abis } from 'viem/tempo'

const TEMPO_RPC_URL = process.env.NEXT_PUBLIC_TEMPO_RPC_URL ||
  'https://dreamy-northcutt:recursing-payne@rpc.testnet.tempo.xyz'

const ALPHA_USD_ADDRESS = '0x20c0000000000000000000000000000000000001' as const

async function main() {
  console.log('=== AcmeUSD Token Deployment Script ===\n')

  // Check for private key
  const privateKey = process.env.ACME_TREASURY_PRIVATE_KEY
  if (!privateKey) {
    console.error('Error: ACME_TREASURY_PRIVATE_KEY not set in .env')
    console.log('\nTo generate a new wallet:')
    console.log('1. Run: npx tsx scripts/generate-wallet.ts')
    console.log('2. Add the private key to .env')
    console.log('3. Fund the wallet using the Tempo faucet')
    process.exit(1)
  }

  // Create account from private key
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  console.log(`Treasury Address: ${account.address}`)

  // Create clients
  const publicClient = createPublicClient({
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })

  const walletClient = createWalletClient({
    account,
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })

  // Check balance first
  console.log('\nChecking AlphaUSD balance for gas fees...')
  try {
    const balance = await publicClient.readContract({
      address: ALPHA_USD_ADDRESS,
      abi: Abis.tip20,
      functionName: 'balanceOf',
      args: [account.address],
    })
    const balanceFormatted = Number(balance) / 1e6
    console.log(`AlphaUSD Balance: $${balanceFormatted.toFixed(2)}`)

    if (balanceFormatted < 0.01) {
      console.error('\nInsufficient AlphaUSD balance. Please fund your wallet first.')
      console.log('You can use the Tempo faucet or run:')
      console.log('  npx tsx scripts/fund-wallet.ts')
      process.exit(1)
    }
  } catch (error) {
    console.log('Could not check balance (wallet may be new)')
  }

  // Deploy AcmeUSD token
  console.log('\n--- Step 1: Deploy AcmeUSD Token ---')
  console.log('Token Name: AcmeUSD')
  console.log('Token Symbol: ACME')
  console.log('Currency: USD')

  try {
    const result = await Actions.token.createSync(walletClient, {
      name: 'AcmeUSD',
      symbol: 'ACME',
      currency: 'USD',
      feeToken: ALPHA_USD_ADDRESS,
    })

    console.log('\n✅ Token deployed successfully!')
    console.log(`Token Address: ${result.token}`)
    console.log(`Transaction Hash: ${result.receipt.transactionHash}`)
    console.log(`Explorer: https://explore.tempo.xyz/tx/${result.receipt.transactionHash}`)

    // Save to env hint
    console.log('\n--- Next Steps ---')
    console.log('Add this to your .env file:')
    console.log(`NEXT_PUBLIC_ACME_USD_ADDRESS="${result.token}"`)
    console.log(`NEXT_PUBLIC_ACME_TREASURY_ADDRESS="${account.address}"`)

    console.log('\nThen run: npx tsx scripts/setup-fee-amm.ts')
    console.log('to add liquidity so users can pay fees with AcmeUSD')

    return result.token
  } catch (error) {
    console.error('\n❌ Token deployment failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)
