# AcmeUSD Stablecoin On/Off-Ramp

A stablecoin on-ramp and off-ramp for the Tempo network. Users can purchase AcmeUSD tokens with USD (via Stripe) and convert them back to USD.

## Prerequisites
p
- Node.js 18+
- pnpm

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Neon PostgreSQL (free)

1. Go to [neon.tech](https://neon.tech) and sign up (no credit card required)
2. Create a new project (any name, e.g., "acme-stablecoin")
3. Copy the connection string from the dashboard

### 3. Configure environment variables

Copy the example env file and add your values:

```bash
cp .env.example .env
```

Update `.env` with your Neon connection string:

```bash
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 4. Initialize the database

```bash
pnpm prisma db push
pnpm prisma generate
```

### 5. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (test mode) |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `ACME_TREASURY_PRIVATE_KEY` | Treasury wallet private key for minting/burning |
| `NEXT_PUBLIC_ACME_USD_ADDRESS` | Deployed AcmeUSD token address |

## Tech Stack

- **Frontend:** Next.js 16, React, Tailwind CSS
- **Blockchain:** Wagmi + Viem with Tempo extensions
- **Database:** Prisma + Neon (serverless PostgreSQL)
- **Payments:** Stripe (test mode)
- **Wallets:** Tempo passkey wallets (WebAuthn)
