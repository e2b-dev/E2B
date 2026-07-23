import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

test('Cloudflare Workers marker wins over Node-compat process.release', async () => {
  // Workers' nodejs_compat (and vitest-pool-workers) populate
  // process.release.name, so the explicit marker must take precedence.
  vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' })

  const { runtime } = await import('../src/utils')

  expect(runtime).toBe('cloudflare-worker')
})

test('Node is detected when no explicit runtime marker is present', async () => {
  const { runtime } = await import('../src/utils')

  expect(runtime).toBe('node')
})
