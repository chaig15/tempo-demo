/**
 * Setup Fee AMM Liquidity Script
 *
 * Adds liquidity to the Fee AMM so users can pay Tempo fees with AcmeUSD.
 * Run with: npx tsx scripts/setup-fee-amm.ts
 *
 * Prerequisites:
 * - AcmeUSD token deployed (NEXT_PUBLIC_ACME_USD_ADDRESS set)
 * - Treasury funded with AlphaUSD
 */

import 'dotenv/config'
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoModerato } from 'viem/chains'
import { Actions, Abis } from 'viem/tempo'

const TEMPO_RPC_URL = process.env.NEXT_PUBLIC_TEMPO_RPC_URL ||
  'https://rpc.moderato.tempo.xyz'

const ALPHA_USD_ADDRESS = '0x20c0000000000000000000000000000000000001' as const

async function main() {
  console.log('=== Setup Fee AMM Liquidity ===\n')

  const privateKey = process.env.ACME_TREASURY_PRIVATE_KEY
  const acmeUsdAddress = process.env.NEXT_PUBLIC_ACME_USD_ADDRESS

  if (!privateKey) {
    console.error('Error: ACME_TREASURY_PRIVATE_KEY not set in .env')
    process.exit(1)
  }

  if (!acmeUsdAddress) {
    console.error('Error: NEXT_PUBLIC_ACME_USD_ADDRESS not set in .env')
    console.log('Run: npx tsx scripts/deploy-token.ts first')
    process.exit(1)
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  console.log(`Treasury Address: ${account.address}`)
  console.log(`AcmeUSD Address: ${acmeUsdAddress}`)

  const publicClient = createPublicClient({
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })

  const walletClient = createWalletClient({
    account,
    chain: tempoModerato,
    transport: http(TEMPO_RPC_URL),
  })

  // Check AlphaUSD balance
  console.log('\nChecking AlphaUSD balance...')
  const balance = await publicClient.readContract({
    address: ALPHA_USD_ADDRESS,
    abi: Abis.tip20,
    functionName: 'balanceOf',
    args: [account.address],
  })

  const balanceFormatted = Number(balance) / 1e6
  console.log(`AlphaUSD Balance: $${balanceFormatted.toFixed(2)}`)

  // We need at least $100 for liquidity + some for gas
  const liquidityAmount = parseUnits('100', 6) // $100 USD
  if (balance < liquidityAmount + parseUnits('1', 6)) {
    console.error('\nInsufficient AlphaUSD balance.')
    console.log('Need at least $101 AlphaUSD (100 for liquidity + 1 for gas)')
    console.log('Run: npx tsx scripts/fund-wallet.ts')
    process.exit(1)
  }

  // Add liquidity to Fee AMM
  console.log('\n--- Adding Fee AMM Liquidity ---')
  console.log(`User Token (AcmeUSD): ${acmeUsdAddress}`)
  console.log(`Validator Token (AlphaUSD): ${ALPHA_USD_ADDRESS}`)
  console.log(`Liquidity Amount: $100 AlphaUSD`)

  try {
    const result = await Actions.amm.mintSync(walletClient, {
      userTokenAddress: acmeUsdAddress as `0x${string}`,
      validatorTokenAddress: ALPHA_USD_ADDRESS,
      validatorTokenAmount: liquidityAmount,
      to: account.address,
      feeToken: ALPHA_USD_ADDRESS,
    })

    console.log('\n✅ Fee AMM liquidity added successfully!')
    console.log(`Transaction Hash: ${result.receipt.transactionHash}`)
    console.log(`Explorer: https://explore.tempo.xyz/tx/${result.receipt.transactionHash}`)

    console.log('\n--- Setup Complete! ---')
    console.log('Users can now pay Tempo network fees using AcmeUSD!')
    console.log('\nYour environment variables should be:')
    console.log(`NEXT_PUBLIC_ACME_USD_ADDRESS="${acmeUsdAddress}"`)
    console.log(`NEXT_PUBLIC_ACME_TREASURY_ADDRESS="${account.address}"`)

  } catch (error) {
    console.error('\n❌ Failed to add liquidity:', error)
    process.exit(1)
  }
}

main().catch(console.error)
