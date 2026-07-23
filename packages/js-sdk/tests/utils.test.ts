import { afterEach, expect, test, vi } from 'vitest'
import { fileURLToPath } from 'node:url'

import { dynamicRequire, sha256 } from '../src/utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('dynamicRequire loads Node.js built-in modules', () => {
  const url = dynamicRequire<typeof import('node:url')>('node:url')
  expect(url.fileURLToPath).toBe(fileURLToPath)
})

test('sha256 uses WebCrypto when available', async () => {
  expect(await sha256('hello')).toBe(
    'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
  )
})

test('sha256 falls back to node:crypto when WebCrypto is unavailable', async () => {
  vi.stubGlobal('crypto', undefined)
  expect(await sha256('hello')).toBe(
    'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
  )
})
