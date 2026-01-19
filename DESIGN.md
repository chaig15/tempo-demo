# AcmeUSD On/Off-Ramp Design Document

## Overview

This document outlines the design for ACME's stablecoin on/off-ramp system on the Tempo network. The system enables users to:
- **On-ramp**: Pay USD to receive AcmeUSD tokens in their Tempo wallet
- **Off-ramp**: Convert AcmeUSD back to USD sent to their payment method

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router) with React
- **Backend**: Next.js API Routes
- **Blockchain**: Tempo Testnet via `wagmi` + `viem`
- **Payments**: Stripe (Test Mode) - no real money, full integration experience
- **Database**: SQLite (via Prisma) for transaction tracking
- **Authentication**: Tempo passkey wallets (WebAuthn)
- **Deployment**: Railway (with persistent SQLite volume)

### System Components

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
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API Routes                            │    │
│  │  POST /api/onramp/initiate   - Create payment intent     │    │
│  │  POST /api/onramp/confirm    - Confirm & mint tokens     │    │
│  │  POST /api/offramp/initiate  - Create withdrawal request │    │
│  │  POST /api/offramp/confirm   - Verify burn & queue payout│    │
│  │  GET  /api/transactions      - Transaction history       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │    Database     │  │  ACME Treasury  │  │ Stripe Test     │  │
│  │   (SQLite)      │  │    Wallet       │  │   Mode API      │  │
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

## Core Requirements Analysis

### 1. On-ramp: USD → AcmeUSD

**Flow:**
1. User connects passkey wallet
2. User enters USD amount to purchase
3. System creates Stripe PaymentIntent (test mode)
4. User enters card details via Stripe Elements (use test card `4242 4242 4242 4242`)
5. Stripe webhook confirms payment → backend mints AcmeUSD to user's wallet
6. User receives AcmeUSD tokens

**Safety Guarantees:**
- Mint only occurs after Stripe webhook confirms `payment_intent.succeeded`
- Transaction is atomic: Stripe PaymentIntent ID linked to mint tx hash
- Idempotency: same PaymentIntent ID cannot trigger multiple mints
- Stripe handles all PCI compliance for card data

### 2. Off-ramp: AcmeUSD → USD

**Flow:**
1. User initiates withdrawal request with amount
2. System generates unique withdrawal ID
3. User signs transaction to transfer AcmeUSD to ACME treasury
4. Backend verifies on-chain transfer receipt
5. ACME burns received tokens
6. System queues USD payout to user's payment method (simulated)

**Safety Guarantees:**
- Tokens are burned only after confirmed receipt
- Payout queued only after successful burn
- Full audit trail with transaction hashes

### 3. 100% Backing Invariant

**Mechanism:**
```
Total AcmeUSD Supply = Total USD Deposits - Total USD Withdrawals

On-ramp:  USD received → mint AcmeUSD (supply increases)
Off-ramp: AcmeUSD burned → USD paid out (supply decreases)
```

**Verification:**
- All mints require corresponding payment record
- All burns require corresponding payout record
- Supply can be audited: `totalSupply()` should equal net deposits

### 4. Pay Fees with AcmeUSD

**Requirement:** Users must be able to pay Tempo network fees using AcmeUSD.

**Implementation:**
1. Deploy AcmeUSD as TIP-20 token (USD-denominated)
2. Add liquidity to Fee AMM (AcmeUSD/AlphaUSD pair)
3. Configure transactions to use AcmeUSD as `feeToken`

**Initial Liquidity:**
- ACME provides initial Fee AMM liquidity using AlphaUSD from faucet
- First LP must burn 1,000 units (~$0.002) as anti-griefing measure

## Token Design

### AcmeUSD Token

```typescript
// Token creation parameters
{
  name: "AcmeUSD",
  symbol: "ACME",
  currency: "USD",  // USD-denominated for fee eligibility
  decimals: 6       // Standard stablecoin precision
}
```

### Role-Based Access Control

| Role | Capability | Holder |
|------|------------|--------|
| DEFAULT_ADMIN_ROLE | Grant/revoke roles, manage token | ACME Admin Wallet |
| ISSUER_ROLE | Mint and burn tokens | ACME Treasury Wallet |

**Security:** Treasury wallet is a server-side managed key, separate from admin.

## Database Schema

```prisma
model Transaction {
  id            String   @id @default(cuid())
  type          String   // "onramp" | "offramp"
  status        String   // "pending" | "completed" | "failed"
  userAddress   String   // User's Tempo wallet address
  amount        Decimal  // Amount in USD/AcmeUSD
  paymentId     String?  // Mock payment reference
  txHash        String?  // Tempo transaction hash
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model PaymentMethod {
  id            String   @id @default(cuid())
  userAddress   String
  type          String   // "card" | "bank"
  last4         String   // Last 4 digits for display
  createdAt     DateTime @default(now())
}
```

## API Design

### On-ramp Endpoints

#### POST /api/onramp/initiate
```typescript
// Request
{
  userAddress: "0x...",
  amountUsd: 100
}

// Response
{
  paymentIntentId: "pi_xxx",
  amountUsd: 100,
  amountAcmeUsd: "100000000", // 100 * 10^6
  expiresAt: "2024-..."
}
```

#### POST /api/onramp/confirm
```typescript
// Request
{
  paymentIntentId: "pi_xxx",
  userAddress: "0x..."
}

// Response
{
  success: true,
  txHash: "0x...",
  amountMinted: "100000000"
}
```

### Off-ramp Endpoints

#### POST /api/offramp/initiate
```typescript
// Request
{
  userAddress: "0x...",
  amountAcmeUsd: "100000000",
  paymentMethodId: "pm_xxx"
}

// Response
{
  withdrawalId: "wd_xxx",
  treasuryAddress: "0x...",  // Where to send tokens
  amountAcmeUsd: "100000000",
  amountUsd: 100
}
```

#### POST /api/offramp/confirm
```typescript
// Request
{
  withdrawalId: "wd_xxx",
  transferTxHash: "0x..."  // User's transfer to treasury
}

// Response
{
  success: true,
  burnTxHash: "0x...",
  payoutStatus: "queued",
  estimatedArrival: "2024-..."
}
```

## Security Considerations

### Fund Safety

1. **No Pre-minting**: Tokens only minted after payment verification
2. **Atomic Operations**: Database transaction wraps payment + mint
3. **Idempotency Keys**: Prevent duplicate processing
4. **Server-side Signing**: Treasury key never exposed to client

### Attack Vectors Mitigated

| Attack | Mitigation |
|--------|------------|
| Double-mint | Idempotency on paymentIntentId |
| Fake payment | Server verifies payment status |
| Front-running | Mint happens server-side |
| Treasury drain | Only ISSUER_ROLE can mint/burn |

## User Experience

### On-ramp Flow
1. Connect wallet (passkey biometric)
2. Enter USD amount
3. Enter card details (simulated form)
4. Click "Buy AcmeUSD"
5. See confirmation + balance update

### Off-ramp Flow
1. Enter AcmeUSD amount to withdraw
2. Select/add payment method
3. Review & sign transaction (passkey)
4. See payout confirmation

## Implementation Plan

### Phase 1: Setup & Token Deployment
- [ ] Initialize Next.js project with Wagmi/Viem
- [ ] Configure Tempo testnet connection
- [ ] Create admin scripts to deploy AcmeUSD token
- [ ] Grant ISSUER_ROLE to treasury wallet
- [ ] Add Fee AMM liquidity

### Phase 2: Core On-ramp
- [ ] Implement passkey wallet connection UI
- [ ] Build on-ramp form with amount input
- [ ] Create mock payment service
- [ ] Implement mint endpoint
- [ ] Add transaction tracking

### Phase 3: Core Off-ramp
- [ ] Build off-ramp form
- [ ] Implement transfer-to-treasury flow
- [ ] Create burn endpoint
- [ ] Add payout queue (simulated)

### Phase 4: Polish
- [ ] Transaction history page
- [ ] Error handling & edge cases
- [ ] Balance display component
- [ ] Mobile responsiveness

## Testing Strategy

### Unit Tests
- Payment intent creation
- Mint amount calculation
- Idempotency enforcement

### Integration Tests
- Full on-ramp flow (mock payment → mint)
- Full off-ramp flow (transfer → burn → payout)
- Fee payment with AcmeUSD

### Manual Testing
- Testnet deployment verification
- Passkey wallet flow
- Explorer transaction verification

## Fee Sponsorship Model

ACME will sponsor all transaction fees for users, providing a gasless experience while transparently showing the sponsorship.

### Implementation
```typescript
// All user transactions include feePayer parameter
Hooks.token.useTransferSync({
  // ... transfer params
  feePayer: ACME_TREASURY_ADDRESS,  // ACME pays the fee
})
```

### UI Display
Users will see:
- "Transaction fee: $0.001 (sponsored by ACME)"
- Fee breakdown in transaction receipts

This demonstrates Tempo's fee sponsorship capability while keeping UX smooth.

## Tempo Testnet Tokens

The Tempo testnet faucet provides these pre-deployed stablecoins:

| Token | Address | Notes |
|-------|---------|-------|
| pathUSD | `0x20c0000000000000000000000000000000000000` | Base/path token |
| AlphaUSD | `0x20c0000000000000000000000000000000000001` | Primary test token, used for fees |
| BetaUSD | `0x20c0000000000000000000000000000000000002` | Alternative test token |
| ThetaUSD | `0x20c0000000000000000000000000000000000003` | Alternative test token |

**Note:** The CLAUDE.md mentions `linkingUSD` which may be an internal/older reference. The faucet uses `AlphaUSD` as the primary fee token.

For AcmeUSD, we deploy a new TIP-20 token and pair it with AlphaUSD in the Fee AMM.

## Deployment & Demo Considerations

### Railway Deployment
- SQLite database with persistent volume
- Environment variables for Stripe keys and treasury private key
- Automatic deployments from GitHub

### Demo Mode Banner
- Show "Testnet Demo" indicator in UI
- Display test card number hint: `4242 4242 4242 4242`
- Link to Tempo Explorer for transaction verification

### No Reset (Audit Trail)
We intentionally do NOT implement a reset feature:
- All transactions preserved for audit/demo purposes
- On-chain state cannot be reset anyway (minted tokens persist)
- Historical data demonstrates system working over time
- Better for interview discussion: "Here's 50 test transactions we ran"

## Open Questions / Decisions

1. **Treasury Key Management**: For production, use HSM or MPC. For demo, environment variable is acceptable.

## Appendix: Tempo SDK Reference

### Key Hooks Used
```typescript
// Token operations
Hooks.token.useCreateSync()     // Deploy token
Hooks.token.useMintSync()       // Mint to address
Hooks.token.useBurnSync()       // Burn from treasury
Hooks.token.useTransferSync()   // Transfer tokens
Hooks.token.useGetBalance()     // Check balance
Hooks.token.useGrantRolesSync() // Grant issuer role

// Fee AMM
Hooks.amm.useMintSync()         // Add liquidity
Hooks.amm.usePool()             // Check pool state

// Faucet (testnet)
Hooks.faucet.useFundSync()      // Get test AlphaUSD

// Wallet
webAuthn connector              // Passkey authentication
useConnection()                 // Get connected address
```

### Testnet Configuration
```typescript
import { tempoTest } from 'wagmi/chains'
import { webAuthn, KeyManager } from 'wagmi/tempo'

const config = createConfig({
  chains: [tempoTest],
  connectors: [
    webAuthn({ keyManager: KeyManager.localStorage() })
  ],
  transports: {
    [tempoTest.id]: http('https://dreamy-northcutt:recursing-payne@rpc.testnet.tempo.xyz')
  }
})
```
