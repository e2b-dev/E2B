import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, sandboxTest } from '../setup'

/**
 * Regression test: Sandbox.connect() with explicit apiKey should allow
 * pause() to succeed even when E2B_API_KEY is not set in the environment.
 *
 * See: https://github.com/e2b-dev/E2B/pull/1218
 */
sandboxTest.skipIf(isDebug)(
  'pause() uses apiKey from connectionConfig when E2B_API_KEY is not set',
  async ({ sandbox }) => {
    // Save and clear the environment API key
    const savedApiKey = process.env.E2B_API_KEY
    delete process.env.E2B_API_KEY

    try {
      // Get the apiKey that was used to create this sandbox
      const finalApiKey = savedApiKey
      if (finalApiKey === undefined) {
        throw new Error('apiKey must be defined at this point')
      }

      // Connect to the sandbox with an explicit apiKey (E2B_API_KEY is now unset)
      const connected = await Sandbox.connect(sandbox.sandboxId, {
        apiKey: finalApiKey,
      })

      // pause() should succeed using the apiKey from connectionConfig
      // rather than requiring E2B_API_KEY to be set
      const paused = await connected.pause()
      assert.isTrue(
        paused,
        'pause() should return true when successfully pausing a running sandbox'
      )

      // Verify the sandbox is actually paused
      assert.isFalse(
        await connected.isRunning(),
        'sandbox should be paused after pause()'
      )
    } finally {
      // Restore the environment API key
      if (savedApiKey !== undefined) {
        process.env.E2B_API_KEY = savedApiKey
      } else {
        delete process.env.E2B_API_KEY
      }
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'pause() returns false when sandbox is already paused',
  async ({ sandbox }) => {
    // Pause the sandbox first
    const firstPause = await sandbox.pause()
    assert.isTrue(firstPause, 'first pause() should return true')

    // Verify the sandbox is actually paused before the second attempt
    assert.isFalse(
      await sandbox.isRunning(),
      'sandbox should be paused after first pause()'
    )

    // Try to pause again - should return false since already paused
    const secondPause = await sandbox.pause()
    assert.isFalse(
      secondPause,
      'pause() should return false when sandbox is already paused'
    )
  }
)

sandboxTest.skipIf(isDebug)(
  'pause() works on connected sandbox with apiKey in connectionConfig',
  async ({ sandbox }) => {
    const apiKey = process.env.E2B_API_KEY
    if (apiKey === undefined) {
      throw new Error('apiKey must be defined at this point')
    }

    // Connect to the sandbox using apiKey from connectionConfig
    const connected = await Sandbox.connect(sandbox.sandboxId, {
      apiKey,
    })

    // Ensure the sandbox is running before pausing
    assert.isTrue(await sandbox.isRunning())

    // Pause the connected sandbox
    const paused = await connected.pause()
    assert.isTrue(paused, 'pause() should succeed on connected sandbox')

    // Verify it's paused
    assert.isFalse(await connected.isRunning())
  }
)
