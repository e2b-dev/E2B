import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { loadConfig } from '../src/config'

describe('loadConfig', () => {
  let configPath: string

  beforeEach(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2b-toml-'))
    configPath = path.join(dir, 'e2b.toml')
  })

  afterEach(async () => {
    await fs.rm(path.dirname(configPath), { recursive: true, force: true })
  })

  test('loads a valid config and migrates legacy keys', async () => {
    await fs.writeFile(
      configPath,
      'id = "abc"\nname = "my-template"\ndockerfile = "e2b.Dockerfile"\ncpu_count = 2\n'
    )

    expect(await loadConfig(configPath)).toEqual({
      template_id: 'abc',
      template_name: 'my-template',
      dockerfile: 'e2b.Dockerfile',
      cpu_count: 2,
    })
  })

  test('rejects empty required fields', async () => {
    await fs.writeFile(configPath, 'template_id = ""\ndockerfile = ""\n')

    const error = await loadConfig(configPath).catch((err: Error) => err)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('→ at template_id')
    expect((error as Error).message).toContain('→ at dockerfile')
  })

  test('accepts quoted numbers like the yup schema did', async () => {
    await fs.writeFile(
      configPath,
      'template_id = "abc"\ndockerfile = "e2b.Dockerfile"\ncpu_count = "2"\nmemory_mb = "512"\n'
    )

    expect(await loadConfig(configPath)).toMatchObject({
      cpu_count: 2,
      memory_mb: 512,
    })
  })

  test.each(['cpu_count = true', 'cpu_count = "two"', 'memory_mb = 1979-05-27'])(
    'rejects a non-numeric %s',
    async (line: string) => {
      await fs.writeFile(
        configPath,
        `template_id = "abc"\ndockerfile = "e2b.Dockerfile"\n${line}\n`
      )

      await expect(loadConfig(configPath)).rejects.toThrow('Invalid config')
    }
  )

  test('reports every invalid field', async () => {
    await fs.writeFile(
      configPath,
      'dockerfile = "e2b.Dockerfile"\nmemory_mb = 64\n'
    )

    const error = await loadConfig(configPath).catch((err: Error) => err)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(`Invalid config ${configPath}`)
    expect((error as Error).message).toContain('→ at template_id')
    expect((error as Error).message).toContain('→ at memory_mb')
  })
})
