import { expect, inject, test } from 'vitest'

import { template } from '../../template'

async function invokeWorker(url: string, body: object) {
  // Retry while the fresh workers.dev subdomain propagates.
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await response.text()
      try {
        return { status: response.status, body: JSON.parse(text) }
      } catch {
        // Cloudflare edge error page (e.g. DNS still propagating) — retry.
        lastError = new Error(
          `non-JSON response (${response.status}): ${text.slice(0, 200)}`
        )
      }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

test('sandbox lifecycle inside a deployed Cloudflare Worker', async () => {
  // Deployed by setup.mts via `wrangler deploy --temporary`.
  const workerUrl = inject('cfWorkerUrl')
  expect(process.env.E2B_API_KEY, 'E2B_API_KEY is required').toBeDefined()

  const { status, body } = await invokeWorker(workerUrl, {
    apiKey: process.env.E2B_API_KEY,
    domain: process.env.E2B_DOMAIN || undefined,
    template,
  })

  expect(body.error, 'worker reported an error').toBeUndefined()
  expect(status).toBe(200)
  expect(body.isRunning).toBe(true)
  expect(body.exitCode).toBe(0)
  expect(body.stdout).toBe('Hello, World!\n')
  expect(body.content).toBe('Hello, World!')
  expect(body.ok).toBe(true)
})
