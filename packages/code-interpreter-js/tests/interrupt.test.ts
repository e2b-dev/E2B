import { expect } from 'vitest'

import { sandboxTest, wait } from './setup'

sandboxTest(
  'subsequent execution works after client timeout',
  async ({ sandbox }) => {
    // Start a long-running execution with a short timeout.
    // This simulates a client disconnect: the SDK aborts the connection,
    // which should trigger the server to interrupt the kernel (#213).
    await expect(
      sandbox.runCode('import time; time.sleep(300)', { timeoutMs: 3_000 })
    ).rejects.toThrow()

    // Wait for the server to detect the disconnect (via keepalive write
    // failure) and interrupt the kernel.
    await wait(5_000)

    // Run a simple execution. Without the kernel interrupt fix, this would
    // block behind the still-running sleep(30) and time out.
    const result = await sandbox.runCode('1 + 1', { timeoutMs: 10_000 })
    expect(result.text).toEqual('2')
  },
  60_000
)
