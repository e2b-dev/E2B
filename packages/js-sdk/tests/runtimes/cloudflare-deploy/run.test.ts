import { expect, inject, test } from 'vitest'

import { template } from '../../template'

test(
  'sandbox lifecycle inside a deployed Cloudflare Worker',
  // setup.mts waits for the fresh workers.dev subdomain to propagate before
  // tests run; these retries only absorb transient blips — a stray
  // propagation error page (404 "nothing is here yet" for the route, 500
  // "Script not found" from a colo that lags behind the one setup.mts
  // probed) or an undici DNS/connect error ("fetch failed"). Any other
  // Cloudflare error page is a real failure and propagates.
  {
    retry: {
      count: 10,
      delay: 3_000,
      condition: /non-JSON response \(404|Script not found|fetch failed/,
    },
  },
  async () => {
    // Deployed by setup.mts via `wrangler deploy --temporary`.
    const workerUrl = inject('cfWorkerUrl')
    expect(process.env.E2B_API_KEY, 'E2B_API_KEY is required').toBeDefined()

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.E2B_API_KEY,
        domain: process.env.E2B_DOMAIN || undefined,
        template,
      }),
    })

    const text = await response.text()
    let body: Record<string, unknown>
    try {
      body = JSON.parse(text)
    } catch {
      // Cloudflare edge error page — fail and let the retry kick in. The
      // page's <title> says which error it is (the truncated body is just
      // boilerplate shared by every Cloudflare error page).
      const title = text.match(/<title>(.*?)<\/title>/is)?.[1]?.trim()
      throw new Error(
        `non-JSON response (${response.status}${
          title ? `, "${title}"` : ''
        }): ${text.slice(0, 200)}`
      )
    }

    expect(body.error, 'worker reported an error').toBeUndefined()
    expect(response.status).toBe(200)
    expect(body.isRunning).toBe(true)
    expect(body.exitCode).toBe(0)
    expect(body.stdout).toBe('Hello, World!\n')
    expect(body.content).toBe('Hello, World!')
    expect(body.ok).toBe(true)
  }
)
