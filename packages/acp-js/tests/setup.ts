import { Sandbox } from 'e2b'
import { test as base } from 'vitest'

export const sandboxTest = base.extend<{ sandbox: Sandbox }>({
  // eslint-disable-next-line no-empty-pattern
  sandbox: async ({}, use) => {
    const sandbox = await Sandbox.create({ timeoutMs: 5 * 60_000 })
    try {
      await use(sandbox)
    } finally {
      await sandbox.kill()
    }
  },
})
