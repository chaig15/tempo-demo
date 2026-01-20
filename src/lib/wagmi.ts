import { createConfig, http } from 'wagmi'
import { tempoModerato } from 'viem/chains'
import { webAuthn, KeyManager } from 'wagmi/tempo'

// Tempo Moderato testnet RPC with authentication
const TEMPO_RPC_URL = process.env.NEXT_PUBLIC_TEMPO_RPC_URL ||
  'https://rpc.moderato.tempo.xyz'

export const config = createConfig({
  chains: [tempoModerato],
  connectors: [
    webAuthn({
      // HTTP key manager stores passkey credentials in DB for cross-device support
      keyManager: KeyManager.http('/api/keys'),
    }),
  ],
  multiInjectedProviderDiscovery: false,
  transports: {
    [tempoModerato.id]: http(TEMPO_RPC_URL),
  },
})

// Token addresses
export const ALPHA_USD_ADDRESS = '0x20c0000000000000000000000000000000000001' as const
export const BETA_USD_ADDRESS = '0x20c0000000000000000000000000000000000002' as const

// AcmeUSD token address - will be set after deployment
export const ACME_USD_ADDRESS = process.env.NEXT_PUBLIC_ACME_USD_ADDRESS as `0x${string}` | undefined

// ACME Treasury address - the server-side wallet that mints/burns tokens
export const ACME_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_ACME_TREASURY_ADDRESS as `0x${string}` | undefined

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
