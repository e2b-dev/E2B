import { expect, test } from 'vitest'
import { Sandbox } from '../src'

test('kill running sandbox', async () => {
  const sandbox = await Sandbox.create()
  await Sandbox.kill(sandbox.id)
  await expect(async () => {
    await sandbox.refresh(sandbox.id.split('-')[0])
  }).rejects.toThrowError("Not Found")
  await sandbox.close()
})
