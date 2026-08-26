import { expect, test } from 'bun:test'

import { Sandbox } from '../../../src'

test(
  'Bun test',
  async () => {
    const sbx = await Sandbox.create('desktop', { timeoutMs: 60_000 })

    try {
      const size = await sbx.getScreenSize()
      expect(size).toEqual({ width: 1024, height: 768 })
    } finally {
      await sbx.kill()
    }
  },
  { timeout: 60_000 }
)
