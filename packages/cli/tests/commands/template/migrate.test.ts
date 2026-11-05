import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { bufferToText, runCli } from '../../setup'

describe('Template Migrate', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2b-migrate-test-'))
    await fs.writeFile(
      path.join(testDir, 'e2b.toml'),
      'template_id = "legacy"\ndockerfile = "e2b.Dockerfile"\n'
    )
    await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), 'FROM ubuntu\n')
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test('prints the deprecation notice, exits 1 and leaves files untouched', async () => {
    const result = runCli(
      ['template', 'migrate', '--language', 'typescript', '--path', testDir],
      { timeoutMs: 10_000 }
    )

    expect(result.status).toBe(1)
    const output = bufferToText(result.stdout)
    expect(output).toContain('DEPRECATION WARNING')
    expect(output).toContain('https://e2b.dev/docs/template/migration-v2')
    expect((await fs.readdir(testDir)).sort()).toEqual([
      'e2b.Dockerfile',
      'e2b.toml',
    ])
  })
})
