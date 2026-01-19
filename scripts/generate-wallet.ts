/**
 * Generate Treasury Wallet Script
 *
 * Creates a new Ethereum-compatible wallet for the ACME treasury.
 * Run with: npx tsx scripts/generate-wallet.ts
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

console.log('=== Generate Treasury Wallet ===\n')

const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)

console.log('New wallet generated!\n')
console.log(`Address: ${account.address}`)
console.log(`Private Key: ${privateKey}`)

console.log('\n--- IMPORTANT ---')
console.log('1. Save the private key securely!')
console.log('2. Add to your .env file:')
console.log(`   ACME_TREASURY_PRIVATE_KEY="${privateKey}"`)
console.log(`   NEXT_PUBLIC_ACME_TREASURY_ADDRESS="${account.address}"`)
console.log('\n3. Fund this wallet using the Tempo faucet:')
console.log('   npx tsx scripts/fund-wallet.ts')
