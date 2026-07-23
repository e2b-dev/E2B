// Smoke-checks the SDK on real Cloudflare infrastructure: deploys
// worker.mjs to an ephemeral preview account via `wrangler deploy
// --temporary` (no Cloudflare credentials needed), invokes the deployed
// worker to run the full sandbox lifecycle, then deletes the worker.
//
// Unlike the vitest-pool-workers suite (`pnpm test:cf`), this exercises
// wrangler's production bundling and unpolyfilled workerd module semantics,
// so it catches startup crashes like #1579 that the local pool hides.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'

const env = config()

const here = path.dirname(fileURLToPath(import.meta.url))
const distEntry = path.resolve(here, '../../../../dist/index.mjs')

if (!existsSync(distEntry)) {
  const message =
    'dist/index.mjs not found — run `pnpm build` in packages/js-sdk before running the Cloudflare Workers deploy test'
  if (process.env.CI) {
    throw new Error(message)
  }
  console.warn(`Skipping Cloudflare Workers deploy test: ${message}`)
  process.exit(0)
}

const apiKey = process.env.E2B_API_KEY ?? env.parsed?.E2B_API_KEY
const domain = process.env.E2B_DOMAIN || env.parsed?.E2B_DOMAIN || undefined
if (!apiKey) {
  throw new Error('E2B_API_KEY is required to run the deploy test')
}

function wrangler(args) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', ...args],
    {
      cwd: here,
      encoding: 'utf8',
      timeout: 240_000,
      // --temporary only works unauthenticated; drop any ambient Cloudflare
      // auth so a logged-in local environment behaves like CI.
      env: { ...process.env, CLOUDFLARE_API_TOKEN: '' },
    }
  )
  return { ...result, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

console.log('Deploying worker to a temporary Cloudflare preview account...')
const deploy = wrangler(['deploy', '--temporary'])
if (deploy.status !== 0) {
  console.error(deploy.output)
  throw new Error(`wrangler deploy --temporary failed (${deploy.status})`)
}

const workerUrl = deploy.output.match(/https:\/\/\S+\.workers\.dev/)?.[0]
if (!workerUrl) {
  console.error(deploy.output)
  throw new Error(
    'Could not find the deployed workers.dev URL in wrangler output'
  )
}
console.log(`Deployed: ${workerUrl}`)

async function invokeWorker() {
  // Retry while the fresh workers.dev subdomain propagates.
  let lastError
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, domain, template: 'base' }),
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

try {
  const { status, body } = await invokeWorker()
  console.log(`Worker response (${status}):`, JSON.stringify(body))
  if (!body.ok) {
    throw new Error(
      `sandbox lifecycle failed inside the deployed worker: ${body.error ?? JSON.stringify(body)}`
    )
  }
  console.log('Cloudflare Workers deploy test passed')
} finally {
  const cleanup = wrangler(['delete', '--force', '--temporary'])
  if (cleanup.status !== 0) {
    // The preview account expires on its own; cleanup is best-effort.
    console.warn(
      'wrangler delete failed (ignored):',
      cleanup.output.trim().split('\n').at(-1)
    )
  }
}
