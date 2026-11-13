import { TimeoutError } from 'e2b'
import { expect } from 'vitest'

import { isDebug, sandboxTest, wait } from './setup'

sandboxTest.skipIf(isDebug)(
  'runCode throws a descriptive error when the sandbox is killed during execution',
  async ({ sandbox }) => {
    // Keep the execution firmly in-flight until the kill: the sleep is far
    // longer than the kill delay and the execution timeout is pushed well
    // beyond the kill + disconnect-detection window, so the only thing that
    // ends the request is the sandbox being killed (not a body-timer abort
    // or the sleep completing on its own).
    const execution = sandbox.runCode('import time; time.sleep(300)', {
      timeoutMs: 300_000,
    })
    const assertion = Promise.all([
      expect(execution).rejects.toThrowError(
        /sandbox was killed while the request was in progress/
      ),
      expect(execution).rejects.toBeInstanceOf(TimeoutError),
    ])

    await wait(2_000)
    await sandbox.kill()

    await assertion
  },
  60_000
)
