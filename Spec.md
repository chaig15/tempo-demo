# Tempo Product Engineer Take Home

**Duration:** 4 hours

## Overview

You are at a company, ACME, that wants to issue their own stablecoin on the Tempo network (AcmeUSD).

**Task:** Design and implement a system that lets end users Onramp / Offramp AcmeUSD on Tempo.

## Requirements

- A user can pay USD to ACME and get AcmeUSD in their wallet
- A user can ask ACME to offramp from AcmeUSD, get a set of instructions on how to do so, and receive USD to an attached payment method
- The supply of AcmeUSD on Tempo is fully backed by user deposits
- A user can use AcmeUSD to pay fees on Tempo

## Assumptions

- ACME has liquidity to fund the purchase of linkingUSD (no need to solve acquisition)
- All users are legitimate / no fraud in onramp purchasing
- Once a payment is recognized, funds are guaranteed to land with ACME
- All users will be using Tempo passkey wallets

## Evaluation Criteria

- **Operationalizability:** Can a company rely on the money movements? What guarantees exist around users not losing funds?
- **Design approach**
- **End to end functionality**
- **Ease of use**
- **Code quality**

## Tech Stack

- Recommended: TypeScript with `tempo.ts` package
- AI tooling allowed
- Any service provider allowed

## Deliverables

1. **Design artifact** - considerations and choices for approach
2. **Technical artifact** - GitHub repo link or deployed solution link

## Appendix

### Resources

| Resource | URL | Credentials |
|----------|-----|-------------|
| Tempo Docs | docs.tempo.xyz | `curious-mozart` |
| Testnet RPC | rpc.testnet.tempo.xyz | `dreamy-northcutt:recursing-payne` |
| Explorer | explore.tempo.xyz | `eng:zealous-mayer` |

### Testnet Faucet

Fund an address with linkingUSD using Wagmi/Viem:

```javascript
client.request({
  method: "tempo_fundAddress",
  params: [account.address]
});
```

---

## Related

- [[Design Document]]
- [[Implementation Notes]]
