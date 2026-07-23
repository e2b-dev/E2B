import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const urlFile = path.join(here, '.deployed-url')

// Deletes the temporary worker after the suite. Best-effort — the preview
// account expires on its own.
export default function setup() {
  return function teardown() {
    if (!existsSync(urlFile)) {
      return
    }

    const cleanup = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['wrangler', 'delete', '--force', '--temporary'],
      {
        cwd: here,
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, CLOUDFLARE_API_TOKEN: '' },
      }
    )
    if (cleanup.status !== 0) {
      console.warn(
        'wrangler delete failed (ignored):',
        `${cleanup.stdout ?? ''}\n${cleanup.stderr ?? ''}`
          .trim()
          .split('\n')
          .at(-1)
      )
    }
    rmSync(urlFile, { force: true })
  }
}
