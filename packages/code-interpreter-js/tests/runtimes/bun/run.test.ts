import { expect, test } from 'bun:test'

import { Sandbox } from '../../../src'

test(
  'Bun test',
  async () => {
    const sbx = await Sandbox.create({ timeoutMs: 5_000 })

    try {
      const result = await sbx.runCode('print("Hello, World!")')
      expect(result.logs.stdout.join('')).toEqual('Hello, World!\n')
    } finally {
      await sbx.kill()
    }
  },
  { timeout: 30_000 }
)
