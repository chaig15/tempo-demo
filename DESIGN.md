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

**On Off-ramp Payouts**: We considered Stripe Connect for paying users to their own bank accounts. However, Connect requires platform verification even in test mode. For this demo, payouts are **simulated** - the on-chain burn is real, but the USD payout is marked as "processing" without actually hitting Stripe. The database schema includes a `ConnectedAccount` model to show what a full Connect integration would look like.

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
│  │  POST /api/webhooks/stripe   - Backup mint via webhook      │ │
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
  │                        │<── clientSecret ───────│                       │
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
- **Atomic claim for idempotency**: Both confirm and webhook use `updateMany WHERE status='pending'` to claim the transaction. Only one can succeed (returns `count: 1`), the other backs off. This prevents double-mints from race conditions.
- Server holds treasury key, client never sees it
- Webhook backup: If redirect fails (e.g., Amazon Pay), webhook catches it

**Webhook backup for redirect payments:**

Payment methods like Amazon Pay use redirects. If the redirect page fails (404, network issue), the sync confirm flow won't fire. We have a webhook handler at `/api/webhooks/stripe` that listens for `payment_intent.succeeded` and mints tokens if not already done. Both paths are idempotent.

### Off-ramp: AcmeUSD → USD

```
User                    Frontend                 Backend                  Tempo
  │                        │                        │                       │
  │─── Enter amount ──────>│                        │                       │
  │                        │─── POST /initiate ────>│                       │
  │                        │<── treasuryAddress ────│  (validation only)    │
  │                        │                        │                       │
  │─── Confirm ───────────>│  (local confirmation)  │                       │
  │                        │                        │                       │
  │─── Sign transfer ─────>│                        │                       │
  │    (passkey)           │───────────────────────────── Transfer ────────>│
  │                        │<──────────────────────────── txHash ──────────│
  │                        │                        │                       │
  │                        │─── POST /confirm ─────>│                       │
  │                        │    (addr, amount, tx)  │── Create DB record ───│
  │                        │                        │── Verify transfer ───>│
  │                        │                        │<── confirmed ─────────│
  │                        │                        │── Burn tokens ───────>│
  │                        │                        │── Mark payout ────────│
  │                        │                        │   (simulated)         │
  │                        │<── success ────────────│                       │
```

**Key decisions:**
- User transfers to treasury first, then we burn
- We verify the transfer on-chain before burning
- **Late DB record**: Transaction only created after user signs (not on "Continue")—avoids orphaned records from abandoned flows
- Payout is **simulated** for demo (marked as "processing")
- Real Connect integration would create a Stripe Transfer to user's connected account

**Why simulated payouts:**

Stripe Connect requires platform verification even in test mode. For this demo:
- On-chain operations (transfer + burn) are **real**
- USD payout is marked as "processing" without actual Stripe call
- Shows the full UX flow without Connect setup
- Database schema includes `ConnectedAccount` model for reference

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

**Deployed address:** `0x20C000000000000000000000d629524e55e24d36`

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

We seeded $100 initial liquidity using AlphaUSD from the testnet faucet.

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
| Double-mint | Atomic claim: `updateMany WHERE status='pending'` ensures only one process mints |
| Fake payment | Server verifies with Stripe API |
| Front-running | Mint happens server-side, not user-initiated |
| Treasury drain | Only ISSUER_ROLE can mint/burn |
| Replay transfer | Idempotency on transferTxHash |
| Over-withdraw | Client-side balance check + server verifies on-chain transfer amount |

### What We're Not Handling

- **Fraud/chargebacks**: Stripe test mode doesn't have these. In prod, you'd hold funds for dispute period.
- **Rate limiting**: Would add for prod to prevent abuse.
- **KYC**: Out of scope for demo.
- **Real payouts**: Connect requires verification. Payouts are simulated.

## Database Schema

```prisma
model Transaction {
  id                    String   @id @default(cuid())
  type                  String   // "onramp" | "offramp"
  status                String   // "pending" | "processing" | "completed" | "failed"
  userAddress           String
  amountUsd             Float
  amountToken           String   // With decimals, stored as string

  // Stripe (on-ramp)
  stripePaymentIntentId String?  @unique
  stripePaymentStatus   String?

  // Blockchain
  mintTxHash            String?  // On-ramp mint
  transferTxHash        String?  // Off-ramp user transfer
  burnTxHash            String?  // Off-ramp burn

  // Payout (off-ramp)
  paymentMethodId       String?
  payoutStatus          String?  // "processing" (simulated)
  payoutId              String?

  // Metadata
  memo                  String?
  errorMessage          String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([userAddress])
  @@index([stripePaymentIntentId])
  @@index([status])
}

// NOTE: Not used in demo - shows what Connect integration would look like
model ConnectedAccount {
  id                 String   @id @default(cuid())
  userAddress        String   @unique
  stripeAccountId    String   @unique  // acct_xxx
  onboardingComplete Boolean  @default(false)
  chargesEnabled     Boolean  @default(false)
  payoutsEnabled     Boolean  @default(false)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([userAddress])
}
```

## Testnet Configuration

| Item | Value |
|------|-------|
| Network | Tempo Moderato (testnet) |
| Chain ID | 42431 |
| RPC | https://rpc.moderato.tempo.xyz |
| Explorer | https://explore.tempo.xyz |
| AcmeUSD | `0x20C000000000000000000000d629524e55e24d36` |
| Treasury | `0xbf76f389F1CdE4a8d0041CEd69b0409671F79dCa` |
| AlphaUSD | `0x20c0000000000000000000000000000000000001` |

## Demo Considerations

### No Reset Button

Intentionally no reset feature:
- On-chain state can't be reset anyway (tokens persist)
- Historical transactions show the system working over time
- Better for discussion: "Here's 50 test transactions we ran"

### Testnet Banner

UI shows:
- "TESTNET" indicator
- Test card hint: `4242 4242 4242 4242`
- Link to Tempo Explorer for verification

### Treasury Key

For demo: environment variable is fine.
For prod: HSM or MPC custody.

### Simulated Payouts

Off-ramp burns tokens (real on-chain) but marks payout as "processing" without calling Stripe. This shows the full UX without requiring Stripe Connect platform verification.

To enable real payouts:
1. Sign up for Stripe Connect
2. Re-enable `/api/connect/*` routes
3. Update OffRamp component to include bank linking flow
4. Update offramp confirm to create Stripe Transfer

## API Reference

### POST /api/onramp/initiate
```typescript
// Request
{ userAddress: "0x...", amountUsd: 100 }

// Response
{
  clientSecret: "pi_xxx_secret_xxx",  // For Stripe Elements
  paymentIntentId: "pi_xxx",
  amountToken: "100000000"  // 100 * 10^6
}
```

### POST /api/onramp/confirm
```typescript
// Request
{ paymentIntentId: "pi_xxx", userAddress: "0x..." }

// Response
{ success: true, txHash: "0x...", amountMinted: "100000000" }
```

### POST /api/webhooks/stripe
Stripe webhook handler. Listens for `payment_intent.succeeded` and mints if not already processed. Idempotent with confirm endpoint.

### POST /api/offramp/initiate
```typescript
// Request
{ userAddress: "0x...", amountAcmeUsd: "100000000" }

// Response (validation only, no DB record created)
{
  treasuryAddress: "0x...",
  amountAcmeUsd: "100000000",
  amountUsd: 100
}
```

### POST /api/offramp/confirm
```typescript
// Request (creates DB record and processes burn)
{
  userAddress: "0x...",
  amountAcmeUsd: "100000000",
  transferTxHash: "0x..."
}

// Response
{ success: true, burnTxHash: "0x...", payoutStatus: "processing" }
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

## Completed

- [x] Next.js 16 project with App Router
- [x] Wagmi + Viem configured for Tempo Moderato
- [x] Prisma 7 with Neon serverless adapter
- [x] Passkey wallet connection (WebAuthn)
- [x] Stripe integration (test mode)
- [x] On-ramp flow with webhook backup
- [x] Off-ramp flow with simulated payouts
- [x] Transaction history
- [x] Dark theme UI
- [x] AcmeUSD token deployed
- [x] Fee AMM liquidity seeded ($100)
- [x] Treasury funded with AlphaUSD

## What's Left

- [x] Deploy to Vercel
- [x] End-to-end testing with multiple users
- [ ] (Optional) Enable Stripe Connect for real payouts
