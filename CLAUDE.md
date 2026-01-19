# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is the ACME stablecoin on/off-ramp project for Tempo network. The goal is to build a system where users can:
- Pay USD to receive AcmeUSD tokens in their Tempo wallet (onramp)
- Convert AcmeUSD back to USD sent to their payment method (offramp)

## Tempo Network Resources

| Resource | URL | Credentials |
|----------|-----|-------------|
| Docs | docs.tempo.xyz | Password: `curious-mozart` |
| Testnet RPC | rpc.testnet.tempo.xyz | `dreamy-northcutt:recursing-payne` |
| Explorer | explore.tempo.xyz | `eng:zealous-mayer` |

## Key Technical Details

- **SDK:** Use `wagmi` + `viem` with Tempo extensions (tempo.ts has been upstreamed)
- **Wallets:** All users use Tempo passkey wallets (WebAuthn)
- **Faucet:** Fund addresses with AlphaUSD via `Hooks.faucet.useFundSync()` or RPC method

```javascript
// Via Wagmi hook
const { mutate } = Hooks.faucet.useFundSync()
mutate({ account: address })

// Via RPC (alternative)
client.request({
  method: "tempo_fundAddress",
  params: [account.address]
});
```

## Testnet Tokens

| Token | Address |
|-------|---------|
| AlphaUSD | `0x20c0000000000000000000000000000000000001` |
| BetaUSD | `0x20c0000000000000000000000000000000000002` |
| ThetaUSD | `0x20c0000000000000000000000000000000000003` |

## Core Requirements

1. AcmeUSD supply must be 100% backed by user deposits
2. Users can pay Tempo network fees with AcmeUSD
3. No fraud handling needed - payments are guaranteed once recognized

---

## Implementation Status

### Completed

- [x] Next.js 16 project with App Router
- [x] Wagmi + Viem configured for Tempo testnet
- [x] Prisma 7 with Neon serverless adapter (Vercel-compatible)
- [x] Passkey wallet connection UI (WebAuthn)
- [x] Stripe integration (test mode) for payments
- [x] On-ramp flow: payment → mint tokens
- [x] Off-ramp flow: transfer → burn → payout
- [x] Transaction history tracking
- [x] Testnet banner with test card hint
- [x] Token balance display component

### Not Yet Done

- [ ] Add Stripe API keys to `.env` (get from Stripe Dashboard)
- [ ] Deploy AcmeUSD token to Tempo testnet (run admin script)
- [ ] Add Fee AMM liquidity (AcmeUSD/AlphaUSD pair)
- [ ] Grant ISSUER_ROLE to treasury wallet
- [ ] Test full on-ramp/off-ramp flow end-to-end
- [ ] Deploy to Vercel

## Environment Variables Required

```bash
# Database (Neon)
DATABASE_URL="postgresql://..."

# Stripe (Test Mode)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Treasury wallet (server-side only)
TREASURY_PRIVATE_KEY="0x..."

# AcmeUSD token (after deployment)
NEXT_PUBLIC_ACME_TOKEN_ADDRESS="0x..."
```

## Commands

```bash
# Development
pnpm dev

# Database
pnpm prisma generate   # Generate Prisma client
pnpm prisma db push    # Push schema to Neon

# Build
pnpm build
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── onramp/     # initiate, confirm endpoints
│   │   ├── offramp/    # initiate, confirm endpoints
│   │   └── transactions/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── WalletConnect.tsx
│   ├── OnRamp.tsx
│   ├── OffRamp.tsx
│   ├── TokenBalance.tsx
│   ├── TransactionHistory.tsx
│   └── TestnetBanner.tsx
├── lib/
│   ├── wagmi.ts        # Tempo testnet config
│   ├── db.ts           # Prisma + Neon
│   ├── stripe.ts       # Client-side Stripe
│   ├── stripe-server.ts
│   └── tempo-server.ts # Treasury operations
└── generated/prisma/   # Generated Prisma client
```
