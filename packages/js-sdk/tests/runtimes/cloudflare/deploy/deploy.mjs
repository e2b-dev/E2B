// Deploys worker.mjs to an ephemeral Cloudflare preview account via
// `wrangler deploy --temporary` (no Cloudflare credentials needed) and
// writes the deployed URL to .deployed-url for the vitest suite
// (`pnpm test:cf:deploy`) to pick up.
//
// Unlike the vitest-pool-workers suite (`pnpm test:cf`), the deployed
// worker runs with wrangler's production bundling and unpolyfilled workerd
// module semantics, so this catches startup crashes like #1579 that the
// local pool hides.
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const distEntry = path.resolve(here, '../../../../dist/index.mjs')

if (!existsSync(distEntry)) {
  const message =
    'dist/index.mjs not found — run `pnpm build` in packages/js-sdk before deploying the Cloudflare Workers smoke worker'
  if (process.env.CI) {
    throw new Error(message)
  }
  console.warn(`Skipping Cloudflare Workers deploy: ${message}`)
  process.exit(0)
}

console.log('Deploying worker to a temporary Cloudflare preview account...')
const deploy = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['wrangler', 'deploy', '--temporary'],
  {
    cwd: here,
    encoding: 'utf8',
    timeout: 240_000,
    // --temporary only works unauthenticated; drop any ambient Cloudflare
    // auth so a logged-in local environment behaves like CI.
    env: { ...process.env, CLOUDFLARE_API_TOKEN: '' },
  }
)
const output = `${deploy.stdout ?? ''}\n${deploy.stderr ?? ''}`
if (deploy.status !== 0) {
  console.error(output)
  throw new Error(`wrangler deploy --temporary failed (${deploy.status})`)
}

const workerUrl = output.match(/https:\/\/\S+\.workers\.dev/)?.[0]
if (!workerUrl) {
  console.error(output)
  throw new Error(
    'Could not find the deployed workers.dev URL in wrangler output'
  )
}

writeFileSync(path.join(here, '.deployed-url'), workerUrl)
console.log(`Deployed: ${workerUrl}`)
