/**
 * Runnable entrypoint for local development and demos.
 *
 * Demo mode (default, no env vars needed):
 *   pnpm dev:server
 * starts BOTH the payment-gated sandbox server AND a local mock facilitator,
 * using MockUpstream instead of a real E2B account. Safe to run with zero
 * setup, zero cost, zero real wallet.
 *
 * Live mode (real E2B account + real facilitator):
 *   E2B_API_KEY=... PAY_TO=0x... FACILITATOR_URL=https://x402.org/facilitator pnpm dev:server
 */
import { createPaidSandboxApp } from './server.js'
import { RealE2BUpstream, MockUpstream } from './upstream.js'
import { startMockFacilitator } from './mockFacilitator.mjs'

const PORT = parseInt(process.env.PORT || '4022', 10)
const FACILITATOR_PORT = parseInt(process.env.FACILITATOR_PORT || '4099', 10)

async function main() {
  const e2bApiKey = process.env.E2B_API_KEY
  let facilitatorUrl = process.env.FACILITATOR_URL

  if (!facilitatorUrl) {
    await startMockFacilitator(FACILITATOR_PORT)
    facilitatorUrl = `http://localhost:${FACILITATOR_PORT}`
    console.log(`[demo mode] started local mock facilitator on ${facilitatorUrl}`)
  }

  const upstream = e2bApiKey ? new RealE2BUpstream({ apiKey: e2bApiKey }) : new MockUpstream()
  if (!e2bApiKey) {
    console.log('[demo mode] no E2B_API_KEY set — using MockUpstream (no real sandboxes will be created)')
  }

  // A payTo address MUST be supplied by whoever owns this deployment's
  // receiving wallet. This demo default is a throwaway, unfunded, randomly
  // generated test address with zero economic value — never a real business
  // wallet — and is only here so the demo runs with zero setup.
  const payTo = (process.env.PAY_TO ??
    '0x6F388B8629D3BE977EFa43Cb581845C8642cf5f8') as `0x${string}`
  if (!process.env.PAY_TO) {
    console.log(`[demo mode] no PAY_TO set — using a throwaway demo address (${payTo}). Set PAY_TO to your real receiving wallet before going live.`)
  }

  const app = createPaidSandboxApp({
    upstream,
    payTo,
    facilitatorUrl,
    pricePerSandbox: process.env.PRICE_PER_SANDBOX || '$0.05',
  })

  app.listen(PORT, () => {
    console.log(`\n@e2b/x402 demo server listening on http://localhost:${PORT}`)
    console.log(`  POST /sandbox  - create a sandbox, gated by x402 payment (${process.env.PRICE_PER_SANDBOX || '$0.05'})`)
    console.log(`  GET  /health   - health check\n`)
  })
}

main().catch((err) => {
  console.error('failed to start dev server:', err)
  process.exit(1)
})
