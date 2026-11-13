import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { TestProject } from 'vitest/node'

const here = path.dirname(fileURLToPath(import.meta.url))
// wrangler appends ndjson records here (WRANGLER_OUTPUT_FILE_PATH), one of
// which is {type: 'deploy', targets: [urls]}.
const outputFile = path.join(here, '.deploy-output.json')

function wrangler(args: string[]) {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', ...args, '--config', path.join(here, 'wrangler.jsonc')],
    {
      cwd: here,
      encoding: 'utf8',
      timeout: 240_000,
      env: {
        ...process.env,
        // --temporary only works unauthenticated; drop any ambient Cloudflare
        // auth so a logged-in local environment behaves like CI.
        CLOUDFLARE_API_TOKEN: '',
        WRANGLER_OUTPUT_FILE_PATH: outputFile,
      },
    }
  )
  return { ...result, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}` }
}

// A temporary deploy lands on a brand-new account subdomain
// (<worker>.<random-name>.workers.dev), and until both the route and the
// script propagate to the edge Cloudflare serves an HTML error page: a 404
// ("nothing is here yet") for the missing route, or a 500 ("Script not
// found") from a colo that already has the route but not the script. Wait
// for the worker itself to answer (405 to GET, worker.mjs is POST-only) so
// the test's own retries only have to absorb transient network failures.
const propagationErrorTitle = /Script not found/i

async function waitUntilLive(workerUrl: string, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    // Thrown fetch errors (DNS/connect for the fresh subdomain) are also
    // transient — keep waiting on those, but fail fast on anything that is
    // not a propagation error so real errors surface immediately.
    const response = await fetch(workerUrl).catch((err) => {
      console.log(`Worker not reachable yet (${err}), waiting...`)
      return undefined
    })
    if (response) {
      if (response.status === 405) {
        return
      }
      if (response.status === 404) {
        console.log('Worker route not live yet (404), waiting...')
      } else {
        const text = await response.text()
        const title = text.match(/<title>(.*?)<\/title>/is)?.[1]?.trim()
        if (!propagationErrorTitle.test(title ?? '')) {
          throw new Error(
            `Worker at ${workerUrl} answered ${response.status}${
              title ? ` ("${title}")` : ''
            } — not a propagation error: ${text.slice(0, 200)}`
          )
        }
        console.log(
          `Worker script not live yet (${response.status}, "${title}"), waiting...`
        )
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Worker at ${workerUrl} did not come up within ${timeoutMs / 1000}s of deploy`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
}

export default async function setup(project: TestProject) {
  rmSync(outputFile, { force: true })

  console.log('Deploying worker to a temporary Cloudflare preview account...')
  const deploy = wrangler(['deploy', '--temporary'])
  if (deploy.status !== 0) {
    console.error(deploy.output)
    throw new Error(`wrangler deploy --temporary failed (${deploy.status})`)
  }

  let workerUrl: string | undefined
  for (const line of readFileSync(outputFile, 'utf8').split('\n')) {
    if (!line.trim()) {
      continue
    }
    const record = JSON.parse(line)
    if (record.type === 'deploy' && record.targets?.length) {
      workerUrl = record.targets[0]
    }
  }
  if (!workerUrl) {
    console.error(deploy.output)
    throw new Error(
      'Could not find the deployed workers.dev URL in wrangler output'
    )
  }

  console.log(`Deployed: ${workerUrl}`)
  await waitUntilLive(workerUrl)
  console.log('Worker is live.')
  project.provide('cfWorkerUrl', workerUrl)

  return function teardown() {
    // Best-effort — the preview account expires on its own.
    const cleanup = wrangler(['delete', '--force', '--temporary'])
    if (cleanup.status !== 0) {
      console.warn(
        'wrangler delete failed (ignored):',
        cleanup.output.trim().split('\n').at(-1)
      )
    }
    rmSync(outputFile, { force: true })
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    cfWorkerUrl: string
  }
}
