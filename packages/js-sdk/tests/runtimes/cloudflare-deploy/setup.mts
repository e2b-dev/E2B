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

export default function setup(project: TestProject) {
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
