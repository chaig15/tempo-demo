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
