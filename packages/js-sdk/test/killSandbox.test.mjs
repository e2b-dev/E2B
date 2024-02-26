import { expect, test } from 'vitest'
import { Sandbox } from '../src'
import wait from '../src/utils/wait'

test('kill running sandbox', async () => {
  await expect(async () => {
    const sandbox = await Sandbox.create()
    await Sandbox.kill(sandbox.id)
  }).rejects.toThrowError("Not Found")
})
