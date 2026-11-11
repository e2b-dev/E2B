import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { withFileLock } from '../../src/utils/lock'

const options = { staleMs: 30_000, timeoutMs: 2_000 }

let dir: string
let filePath: string
let lockPath: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-lock-'))
  filePath = path.join(dir, 'nested', 'config.json')
  lockPath = `${filePath}.lock`
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('withFileLock', () => {
  test('runs one holder at a time and returns its result', async () => {
    let active = 0
    let maxActive = 0
    const run = (id: number) =>
      withFileLock(
        filePath,
        async () => {
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise((resolve) => setTimeout(resolve, 20))
          active -= 1
          return id
        },
        options
      )

    expect(await Promise.all([1, 2, 3].map(run))).toEqual([1, 2, 3])
    expect(maxActive).toBe(1)
    expect(fs.existsSync(lockPath)).toBe(false)
  })

  test('releases the lock when the holder throws', async () => {
    await expect(
      withFileLock(
        filePath,
        () => {
          throw new Error('boom')
        },
        options
      )
    ).rejects.toThrow('boom')
    expect(fs.existsSync(lockPath)).toBe(false)
  })

  test('takes over a lock left behind by a crashed process', async () => {
    fs.mkdirSync(lockPath, { recursive: true })
    const old = new Date(Date.now() - 60_000)
    fs.utimesSync(lockPath, old, old)

    expect(await withFileLock(filePath, () => 'ran', options)).toBe('ran')
    expect(fs.existsSync(lockPath)).toBe(false)
  })

  test('gives up while a live holder keeps the lock', async () => {
    fs.mkdirSync(lockPath, { recursive: true })

    await expect(
      withFileLock(filePath, () => 'ran', { staleMs: 30_000, timeoutMs: 200 })
    ).rejects.toThrow(
      `Timed out waiting for another e2b process to release ${lockPath}`
    )
    // A live holder's lock is left alone.
    expect(fs.existsSync(lockPath)).toBe(true)
  })
})
