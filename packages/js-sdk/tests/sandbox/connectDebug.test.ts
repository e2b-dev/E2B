import { assert, expect, test, vi } from 'vitest'

import { Sandbox } from '../../src'

test('connect in debug mode does not call the API', async () => {
  const fetchSpy = vi.fn(() => {
    throw new Error('unexpected request in debug mode')
  })
  vi.stubGlobal('fetch', fetchSpy)

  try {
    const sbx = await Sandbox.connect('debug-sandbox-id', {
      debug: true,
      apiKey: 'test-api-key',
    })
    assert.equal(sbx.sandboxId, 'debug-sandbox-id')

    const sameSbx = await sbx.connect()
    assert.strictEqual(sameSbx, sbx)

    expect(fetchSpy).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})
