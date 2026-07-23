import { expect, inject, test } from 'vitest'

import { template } from '../../template'

test(
  'sandbox lifecycle inside a deployed Cloudflare Worker',
  // Retry the whole test while the fresh workers.dev subdomain propagates:
  // Cloudflare serves an HTML error page until the route is live ("non-JSON
  // response"), and fetch itself can fail at the DNS/connect level first
  // (undici throws "fetch failed").
  {
    retry: {
      count: 5,
      delay: 3_000,
      condition: /non-JSON response|fetch failed/,
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
      // Cloudflare edge error page (e.g. DNS still propagating) — fail and
      // let the retry kick in.
      throw new Error(
        `non-JSON response (${response.status}): ${text.slice(0, 200)}`
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
