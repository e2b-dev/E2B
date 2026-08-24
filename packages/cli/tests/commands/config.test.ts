import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const cliPath = path.join(process.cwd(), 'dist', 'index.js')

function runCli(args: string[], cwd: string) {
  const result = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
  })

  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}

describe('e2b.toml is not read outside template migrate', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2b-config-test-'))
    await fs.writeFile(
      path.join(testDir, 'e2b.toml'),
      'template_id = "config-template-id"\ndockerfile = "e2b.Dockerfile"'
    )
  })

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true })
    }
  })

  test('template delete without an argument does not use e2b.toml', () => {
    const output = runCli(['template', 'delete', '--yes'], testDir)

    expect(output).not.toContain('config-template-id')
    expect(output).toContain('No sandbox templates selected')
  })
})
