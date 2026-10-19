import { expect } from 'vitest'

import { NotFoundError, TimeoutError } from '../../../src'
import { sandboxTest } from '../../setup'

sandboxTest(
  'stream input to a command in order',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run('cat', {
      background: true,
      stdin: true,
    })

    const input = sandbox.commands.streamInput(cmd.pid)
    await input.send('a')
    await input.send('b\n')
    await input.send(new TextEncoder().encode('c'))
    await input.close()

    for (let i = 0; i < 10; i++) {
      if (cmd.stdout === 'ab\nc') {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    expect(cmd.stdout).toBe('ab\nc')
    await cmd.kill()
  }
)

sandboxTest('stream input reports a missing process', async ({ sandbox }) => {
  const input = sandbox.commands.streamInput(999999)
  await input.send('missing').catch(() => undefined)

  await expect(input.close()).rejects.toBeInstanceOf(NotFoundError)
})

sandboxTest('stream input respects its timeout', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('cat', {
    background: true,
    stdin: true,
  })
  const input = sandbox.commands.streamInput(cmd.pid, { timeoutMs: 1000 })

  await new Promise((resolve) => setTimeout(resolve, 2000))
  await expect(input.close()).rejects.toBeInstanceOf(TimeoutError)
  await cmd.kill()
})
