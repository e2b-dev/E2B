import { expect, test } from 'vitest'
import { Sandbox } from '../src'

test('kill running sandbox', async () => {
  const sandbox = await Sandbox.create()
  await Sandbox.kill(sandbox.id)
  const list = await Sandbox.list()
  expect(list.map((s) => s.sandboxID)).not.toContain(sandbox.id)
  await sandbox.close()
})
