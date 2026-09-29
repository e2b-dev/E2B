# @e2b/x402

Pay-per-sandbox access to E2B via the [x402](https://www.x402.org/) protocol (HTTP 402) — no E2B account, API key, or credit card required from the caller.

## Why this exists

E2B already ships MCP support, official SDKs for LangChain / Vercel AI SDK / Google ADK / n8n, and a complete `llms.txt`. The one integration it doesn't have yet is **x402** — and E2B's product (ephemeral, metered, per-second compute) is close to the textbook use case for a stablecoin micropayment rail: an autonomous agent that doesn't have (or want to set up) an E2B account can still spin up a sandbox by paying a few cents in USDC, with the payment settling on-chain in the same request.

This package adds exactly that, as a new workspace package (`packages/x402`) following the same conventions as `packages/cli`.

## What it is

A small Express resource server with one payment-gated endpoint:

```
POST /sandbox      -> 402 until paid, then creates a real E2B sandbox and returns { sandboxId, domain, envdAccessToken }
GET  /health        -> health check
```

Payment is handled by the official `@x402/*` packages (the same ones used in [coinbase/x402](https://github.com/coinbase/x402)'s own Express example) — this package does not reimplement any payment or signature logic, it only wires E2B's real `POST /v2/sandboxes` call (see `packages/js-sdk/src/sandbox/sandboxApi.ts::createSandbox` in this repo) behind it.

## Quickstart (zero setup, zero cost)

```bash
cd packages/x402
npm install
npm run dev:server
```

This starts the payment-gated server **and** a local mock x402 facilitator, using `MockUpstream` instead of a real E2B account — safe to run with no API key, no wallet, and no cost. In another terminal:

```bash
curl -X POST http://localhost:4022/sandbox -H 'Content-Type: application/json' -d '{"templateID":"base"}'
# -> HTTP 402, with payment requirements in the `payment-required` header (base64 JSON)
```

To see a full paid round-trip, run the test suite instead (it drives a real x402 client against the server, using a freshly generated, unfunded, throwaway signer):

```bash
npm test
```

```
✓ answers health checks without payment
✓ returns HTTP 402 with correct payment requirements when unpaid
✓ creates a sandbox once a valid x402 payment is presented
```

## Going live

Two things are intentionally **not** set by this package, because they belong to whoever owns the deployment:

| Env var | What it is | Demo default |
|---|---|---|
| `E2B_API_KEY` | A real E2B API key. Without it, the server uses `MockUpstream` and never calls E2B's real API. | unset (mock mode) |
| `PAY_TO` | The USDC-receiving wallet address (Base). | a throwaway, unfunded, randomly generated address — **do not use in production** |
| `FACILITATOR_URL` | An x402 facilitator to verify/settle payments. | a local mock facilitator that accepts any payload (`src/mockFacilitator.mjs`) — **local testing only** |

```bash
E2B_API_KEY=your_real_key \
PAY_TO=0xYourRealReceivingWallet \
FACILITATOR_URL=https://x402.org/facilitator \
PRICE_PER_SANDBOX='$0.05' \
npm run dev:server
```

`FACILITATOR_URL=https://x402.org/facilitator` targets Base Sepolia (testnet). For mainnet, point at Coinbase's CDP facilitator instead (see the [x402 docs](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator)).

## Files

- `src/server.ts` — `createPaidSandboxApp()`, the payment-gated Express app.
- `src/upstream.ts` — `RealE2BUpstream` (calls E2B's actual API) and `MockUpstream` (same shape, no network call — used by tests and the zero-setup demo).
- `src/devServer.ts` — runnable entrypoint wiring the two together, for `npm run dev:server`.
- `src/mockFacilitator.mjs` — a fully local, offline x402 facilitator test double (never touches a real chain or key), used only for local testing/demoing.
- `test/server.test.ts` — end-to-end test: unpaid → 402 → paid (via a throwaway local signer) → 200 with a sandbox.
