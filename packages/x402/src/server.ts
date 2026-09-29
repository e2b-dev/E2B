/**
 * A payment-gated HTTP resource server: `POST /sandbox` creates a real E2B
 * sandbox, paid per-call in USDC via x402 (HTTP 402), with no E2B account,
 * API key, or credit card required from the caller.
 *
 * This fills the one integration gap E2B doesn't already have: MCP, the
 * LangChain/Vercel AI SDK/Google ADK/n8n integrations, and llms.txt are all
 * already shipped by E2B today. x402 is not. Given E2B's product is
 * ephemeral, metered compute, it is close to the canonical use case for a
 * per-call micropayment rail: an agent that doesn't have (or want to set up)
 * an E2B account can still get a sandbox by paying a few cents in USDC.
 *
 * Pattern follows the official x402 monorepo's own Express example
 * (coinbase/x402: examples/typescript/servers/express/index.ts), swapping
 * the toy "weather" handler for a real call into E2B's sandbox API.
 */
import express, { type Express } from 'express'
import { paymentMiddleware } from '@x402/express'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import type { SandboxUpstream } from './upstream.js'

export interface CreatePaidSandboxAppOpts {
  /** Where sandbox-creation calls actually go. RealE2BUpstream in production, MockUpstream in tests/demos. */
  upstream: SandboxUpstream
  /** The USDC-receiving address. Must be supplied by whoever owns this deployment — never generated here. */
  payTo: `0x${string}`
  /** x402 facilitator to verify/settle payments against. A local mock in tests; a real facilitator (e.g. https://x402.org/facilitator for Base Sepolia, or Coinbase CDP's for mainnet) in production. */
  facilitatorUrl: string
  /** CAIP-2 network id. Defaults to Base Sepolia (testnet) so this is safe to demo without real funds. */
  network?: `${string}:${string}`
  /** Price per sandbox creation, e.g. "$0.05". */
  pricePerSandbox?: string
  /** Template to use when the caller doesn't specify one. */
  defaultTemplate?: string
}

export function createPaidSandboxApp(opts: CreatePaidSandboxAppOpts): Express {
  const network = opts.network ?? 'eip155:84532'
  const price = opts.pricePerSandbox ?? '$0.05'
  const defaultTemplate = opts.defaultTemplate ?? 'base'

  const facilitatorClient = new HTTPFacilitatorClient({ url: opts.facilitatorUrl })
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactEvmScheme(),
  )

  const app = express()
  app.use(express.json())

  app.post(
    '/sandbox',
    paymentMiddleware(
      {
        'POST /sandbox': {
          accepts: [
            {
              scheme: 'exact',
              price,
              network,
              payTo: opts.payTo,
            },
          ],
          description:
            'Create a fresh E2B code-execution sandbox. Pay-per-call in USDC via x402 — no E2B account or API key needed.',
          mimeType: 'application/json',
        },
      },
      resourceServer,
    ),
    async (req, res) => {
      try {
        const templateID: string = req.body?.templateID ?? defaultTemplate
        const timeoutMs: number | undefined = req.body?.timeoutMs
        const sandbox = await opts.upstream.createSandbox({ templateID, timeoutMs })
        res.json(sandbox)
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: '@e2b/x402' })
  })

  return app
}
