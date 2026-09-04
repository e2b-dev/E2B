import { sandboxTest } from '../../setup'
import { assert, expect } from 'vitest'

sandboxTest('kill PTY', async ({ sandbox }) => {
  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: () => {},
  })

  const result = await sandbox.pty.kill(terminal.pid)
  assert.isTrue(result)

  // PTY teardown is asynchronous, so wait for the process to disappear.
  await expect(
    sandbox.commands.run(
      `for i in $(seq 1 50); do kill -0 ${terminal.pid} 2>/dev/null || exit 0; sleep 0.1; done; exit 1`
    )
  ).resolves.toMatchObject({ exitCode: 0 })
})

sandboxTest('kill non-existing PTY', async ({ sandbox }) => {
  const nonExistingPid = 999999

  await expect(sandbox.pty.kill(nonExistingPid)).resolves.toBe(false)
})
