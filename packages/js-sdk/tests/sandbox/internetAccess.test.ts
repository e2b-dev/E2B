import { assert, describe } from 'vitest'

import { CommandExitError } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

describe('internet access enabled', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      allowInternetAccess: true,
    },
  })

  sandboxTest.skipIf(isDebug)(
    'internet access enabled',
    async ({ sandbox }) => {
      // Test internet connectivity by making a curl request to a reliable external site
      const result = await sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
      )
      assert.equal(result.exitCode, 0)
      assert.equal(result.stdout.trim(), '200')
    }
  )
})

describe('internet access disabled', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      allowInternetAccess: false,
    },
  })

  sandboxTest.skipIf(isDebug)(
    'internet access disabled',
    async ({ sandbox }) => {
      // Test that internet connectivity is blocked by making a curl request
      try {
        await sandbox.commands.run(
          'curl --connect-timeout 3 --max-time 5 -Is https://e2b.dev'
        )
        // If we reach here, the command succeeded, which means internet access is not properly disabled
        assert.fail('Expected command to fail when internet access is disabled')
      } catch (error) {
        // The command should fail or timeout when internet access is disabled
        assert.isTrue(error instanceof CommandExitError)
        assert.notEqual(error.exitCode, 0)
      }
    }
  )
})

describe('internet access default', () => {
  sandboxTest.skipIf(isDebug)(
    'internet access default',
    async ({ sandbox }) => {
      // Test internet connectivity by making a curl request to a reliable external site
      const result = await sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
      )
      assert.equal(result.exitCode, 0)
      assert.equal(result.stdout.trim(), '200')
    }
  )
})
