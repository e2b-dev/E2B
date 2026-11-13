import { expect } from 'vitest'
import { TimeoutError } from '../../../src/index.js'

import { sandboxTest, isDebug } from '../../setup.js'

sandboxTest.skipIf(isDebug)(
  'killing the sandbox while a command is running throws an actionable error',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run('sleep 60', { background: true })

    await sandbox.kill()

    const err = await cmd.wait().catch((e) => e)
    expect(err).toBeInstanceOf(TimeoutError)
    // The proxy emits Unavailable at a frame boundary; a partial frame remains a
    // transport failure and is disambiguated by the SDK's sandbox health check.
    expect(err.message).toMatch(
      /ended before the stream completed|sandbox was killed or reached its end of life/
    )
  }
)
