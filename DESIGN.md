# AcmeUSD On/Off-Ramp Design Document

## Overview

A stablecoin on/off-ramp for the Tempo network. Users pay USD to get AcmeUSD tokens, or burn AcmeUSD to get USD back. Simple concept, but the implementation touches payments, blockchain, and the intersection of both.

### Goals
- **On-ramp**: USD → AcmeUSD tokens in user's Tempo wallet
- **Off-ramp**: AcmeUSD → USD to user's payment method
- **100% backing**: Every AcmeUSD in circulation is backed 1:1 by USD deposits

## Architecture

### Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Full-stack in one, API routes for backend |
| Blockchain | wagmi + viem | Industry standard, Tempo extensions upstream |
| Payments | Stripe (Test Mode) | Real integration experience without real money |
| Database | Prisma 7 + Neon | Serverless Postgres, Vercel-compatible |
| Auth | Tempo passkey wallets | WebAuthn, no seed phrases for users |
| Deployment | Vercel | Edge-ready, works with Neon out of the box |

**On Stripe Test Mode**: I considered mocking payments entirely, but using Stripe's test mode gives us the real integration—webhooks, payment intents, error handling—without touching real money. Test card `4242 4242 4242 4242` works for all success cases.

**On Neon vs SQLite**: Originally considered SQLite for simplicity, but Neon's serverless driver works natively with Vercel's edge runtime. Prisma 7's driver adapter pattern makes this clean.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Passkey Wallet │  │   On-ramp UI    │  │  Off-ramp UI    │  │
│  │   (WebAuthn)    │  │                 │  │                 │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Application                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    API Routes                                │ │
│  │  POST /api/onramp/initiate   - Create Stripe PaymentIntent  │ │
│  │  POST /api/onramp/confirm    - Verify payment & mint tokens │ │
│  │  POST /api/offramp/initiate  - Create withdrawal request    │ │
│  │  POST /api/offramp/confirm   - Verify transfer & burn       │ │
│  │  GET  /api/transactions      - Transaction history          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Neon DB       │  │  ACME Treasury  │  │  Stripe API     │  │
│  │   (Postgres)    │  │    Wallet       │  │  (Test Mode)    │  │
│  └─────────────────┘  └────────┬────────┘  └─────────────────┘  │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Tempo Testnet       │
                    │  ┌─────────────────┐    │
                    │  │   AcmeUSD Token │    │
                    │  │    (TIP-20)     │    │
                    │  └─────────────────┘    │
                    │  ┌─────────────────┐    │
                    │  │    Fee AMM      │    │
                    │  │  (AcmeUSD/      │    │
                    │  │   AlphaUSD)     │    │
                    │  └─────────────────┘    │
                    └─────────────────────────┘
```

## Flows

### On-ramp: USD → AcmeUSD

```
User                    Frontend                 Backend                  Tempo
  │                        │                        │                       │
  │─── Enter amount ──────>│                        │                       │
  │                        │─── POST /initiate ────>│                       │
  │                        │                        │── Create PaymentIntent│
  │                        │<── paymentIntentId ────│                       │
  │                        │                        │                       │
  │─── Enter card ────────>│                        │                       │
  │    (Stripe Elements)   │                        │                       │
  │                        │─── Confirm payment ───>│ (Stripe)              │
  │                        │                        │                       │
  │                        │─── POST /confirm ─────>│                       │
  │                        │                        │── Verify w/ Stripe    │
  │                        │                        │── Mint AcmeUSD ──────>│
  │                        │                        │<── txHash ────────────│
  │                        │<── success + txHash ───│                       │
  │<── Show confirmation ──│                        │                       │
```

**Key decisions:**
- Mint only after Stripe confirms payment (not on PaymentIntent creation)
- PaymentIntent ID is the idempotency key—same ID can't trigger multiple mints
- Server holds treasury key, client never sees it

### Off-ramp: AcmeUSD → USD

```
User                    Frontend                 Backend                  Tempo
  │                        │                        │                       │
  │─── Enter amount ──────>│                        │                       │
  │                        │─── POST /initiate ────>│                       │
  │                        │<── withdrawalId + ─────│                       │
  │                        │    treasuryAddress     │                       │
  │                        │                        │                       │
  │─── Sign transfer ─────>│                        │                       │
  │    (passkey)           │───────────────────────────── Transfer ────────>│
  │                        │<──────────────────────────── txHash ──────────│
  │                        │                        │                       │
  │                        │─── POST /confirm ─────>│                       │
  │                        │    (txHash)            │── Verify transfer ───>│
  │                        │                        │<── confirmed ─────────│
  │                        │                        │── Burn tokens ───────>│
  │                        │                        │── Create Stripe payout│
  │                        │<── success ────────────│                       │
```

**Key decisions:**
- User transfers to treasury first, then we burn
- We verify the transfer on-chain before burning
- Stripe payout created to show outflow in dashboard (test mode simulates, doesn't hit real bank)

## Token Design

### AcmeUSD (TIP-20)

```typescript
{
  name: "AcmeUSD",
  symbol: "ACME",
  currency: "USD",    // Makes it eligible for fee payment
  decimals: 6         // Standard stablecoin precision
}
```

### Roles

| Role | Can Do |
|------|--------|
| DEFAULT_ADMIN_ROLE | Grant/revoke roles, token admin |
| ISSUER_ROLE | Mint and burn tokens |

For this demo, a single treasury wallet holds both roles. The token creator automatically gets DEFAULT_ADMIN_ROLE, and we grant ISSUER_ROLE to the same wallet for minting/burning.

**Production note**: In production, you'd separate these—admin key in cold storage for rare role management, treasury key hot but scoped to ISSUER_ROLE only. For a testnet demo, one key is fine.

### Fee Payment

Users can pay Tempo network fees with AcmeUSD. This requires:
1. AcmeUSD deployed as TIP-20 with `currency: "USD"`
2. Liquidity in the Fee AMM (AcmeUSD/AlphaUSD pair)

We'll seed initial liquidity using AlphaUSD from the testnet faucet.

## Fee Model

Users pay their own transaction fees in AcmeUSD. This showcases Tempo's multi-token fee system.

| Operation | Who pays fee | Paid in |
|-----------|--------------|---------|
| Mint (on-ramp) | Treasury | AlphaUSD |
| Transfer to treasury (off-ramp) | User | AcmeUSD |
| Burn (off-ramp) | Treasury | AlphaUSD |
| P2P transfers | Sender | AcmeUSD |

**Why this model:**
- Treasury pays for mint/burn because those are server-side operations
- Users pay for their own transfers in AcmeUSD (they have it, fees are ~$0.001)
- No fee sponsorship pool to manage—self-sustaining
- Demonstrates "pay fees with your stablecoin" (the point of the Fee AMM)

Treasury only needs AlphaUSD for its own operations (from testnet faucet).

## Safety Properties

### 100% Backing Invariant

```
Total AcmeUSD Supply = Total USD Deposits - Total USD Withdrawals

On-ramp:  USD in  → mint (supply ↑)
Off-ramp: USD out → burn (supply ↓)
```

Every mint has a corresponding Stripe payment. Every burn has a corresponding payout record.

### Attack Mitigations

| Attack | Mitigation |
|--------|------------|
| Double-mint | Idempotency on Stripe PaymentIntent ID |
| Fake payment | Server verifies with Stripe API |
| Front-running | Mint happens server-side, not user-initiated |
| Treasury drain | Only ISSUER_ROLE can mint/burn |
| Replay transfer | Withdrawal ID + txHash uniqueness |

### What We're Not Handling

- **Fraud/chargebacks**: Stripe test mode doesn't have these. In prod, you'd hold funds for dispute period.
- **Rate limiting**: Would add for prod to prevent abuse.
- **KYC**: Out of scope for demo.

## Database Schema

```prisma
model Transaction {
  id            String   @id @default(cuid())
  type          String   // "onramp" | "offramp"
  status        String   // "pending" | "completed" | "failed"
  userAddress   String
  amount        Decimal
  paymentId     String?  // Stripe PaymentIntent ID or withdrawal ID
  txHash        String?  // Tempo transaction hash
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userAddress])
  @@index([paymentId])
}

model TokenDeployment {
  id            String   @id @default(cuid())
  tokenAddress  String   @unique
  name          String
  symbol        String
  deployTxHash  String
  createdAt     DateTime @default(now())
}
```

## Testnet Tokens

| Token | Address |
|-------|---------|
| pathUSD | `0x20c0000000000000000000000000000000000000` |
| AlphaUSD | `0x20c0000000000000000000000000000000000001` |
| BetaUSD | `0x20c0000000000000000000000000000000000002` |
| ThetaUSD | `0x20c0000000000000000000000000000000000003` |

AcmeUSD gets a new address when we deploy it. We pair it with AlphaUSD for fee payment.

## Demo Considerations

### No Reset Button

Intentionally no reset feature:
- On-chain state can't be reset anyway (tokens persist)
- Historical transactions show the system working over time
- Better for discussion: "Here's 50 test transactions we ran"

### Testnet Banner

UI shows:
- "Testnet Demo" indicator
- Test card hint: `4242 4242 4242 4242`
- Link to Tempo Explorer for verification

### Treasury Key

For demo: environment variable is fine.
For prod: HSM or MPC custody.

## API Reference

### POST /api/onramp/initiate
```typescript
// Request
{ userAddress: "0x...", amountUsd: 100 }

// Response
{
  clientSecret: "pi_xxx_secret_xxx",  // For Stripe Elements
  paymentIntentId: "pi_xxx",
  amountAcmeUsd: "100000000"  // 100 * 10^6
}
```

### POST /api/onramp/confirm
```typescript
// Request
{ paymentIntentId: "pi_xxx", userAddress: "0x..." }

// Response
{ success: true, txHash: "0x...", amountMinted: "100000000" }
```

### POST /api/offramp/initiate
```typescript
// Request
{ userAddress: "0x...", amountAcmeUsd: "100000000" }

// Response
{
  withdrawalId: "wd_xxx",
  treasuryAddress: "0x...",
  amountUsd: 100
}
```

### POST /api/offramp/confirm
```typescript
// Request
{ withdrawalId: "wd_xxx", transferTxHash: "0x..." }

// Response
{ success: true, burnTxHash: "0x...", payoutStatus: "queued" }
```

## Tempo SDK Quick Reference

```typescript
// Token operations
Hooks.token.useCreateSync()      // Deploy TIP-20
Hooks.token.useMintSync()        // Mint to address
Hooks.token.useBurnSync()        // Burn from treasury
Hooks.token.useTransferSync()    // Transfer tokens
Hooks.token.useGetBalance()      // Check balance
Hooks.token.useGrantRolesSync()  // Grant ISSUER_ROLE

// Fee AMM
Hooks.amm.useMintSync()          // Add liquidity
Hooks.amm.usePool()              // Check pool state

// Faucet
Hooks.faucet.useFundSync()       // Get testnet AlphaUSD

// Wallet config
webAuthn({ keyManager: KeyManager.localStorage() })
```

## What's Left

- [ ] Get Stripe test API keys, add to `.env`
- [ ] Deploy AcmeUSD token to testnet
- [ ] Grant ISSUER_ROLE to treasury
- [ ] Seed Fee AMM liquidity
- [ ] End-to-end test
- [ ] Deploy to Vercel
