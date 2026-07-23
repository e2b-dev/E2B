import { afterEach, expect, test, vi } from 'vitest'

// The unit project also runs under Bun (and prospectively Deno), where the
// host runtime's own unstubbable marker (globalThis.Bun / globalThis.Deno)
// correctly wins detection — these scenarios only exist on a Node host.
const isNodeHost =
  typeof (globalThis as any).Bun === 'undefined' &&
  typeof (globalThis as any).Deno === 'undefined'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

test.skipIf(!isNodeHost)(
  'Cloudflare Workers marker wins over Node-compat process.release',
  async () => {
    // Workers' nodejs_compat (and vitest-pool-workers) populate
    // process.release.name, so the explicit marker must take precedence.
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' })

    const { runtime } = await import('../src/utils')

    expect(runtime).toBe('cloudflare-worker')
  }
)

test.skipIf(!isNodeHost)(
  'Node is detected when no explicit runtime marker is present',
  async () => {
    const { runtime } = await import('../src/utils')

    expect(runtime).toBe('node')
  }
)
