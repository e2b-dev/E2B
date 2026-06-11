import { expect } from 'vitest'
import { SandboxError } from '../../../src/index.js'

import { sandboxTest, isDebug } from '../../setup.js'

sandboxTest.skipIf(isDebug)(
  'killing the sandbox while a command is running throws an actionable error',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run('sleep 60', { background: true })

    await sandbox.kill()

    const err = await cmd.wait().catch((e) => e)
    expect(err).toBeInstanceOf(SandboxError)
    // The health check confirms the sandbox is gone, so the error states it outright
    expect(err.message).toContain(
      'sandbox was killed or reached its end of life'
    )
  }
)
