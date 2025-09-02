import { assert, test } from 'vitest'

import { CommandExitError, Sandbox } from '../../src'
import { template, isDebug } from '../setup.js'

test.skipIf(isDebug)('internet access enabled', async () => {
  const sbx = await Sandbox.create(template, {
    allowInternetAccess: true,
  })
  try {
    // Test internet connectivity by making a curl request to a reliable external site
    const result = await sbx.commands.run(
      "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
    )
    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout.trim(), '200')
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('internet access disabled', async () => {
  const sbx = await Sandbox.create(template, {
    allowInternetAccess: false,
  })
  try {
    // Test that internet connectivity is blocked by making a curl request
    try {
      await sbx.commands.run(
        'curl --connect-timeout 3 --max-time 5 -Is https://e2b.dev'
      )
      // If we reach here, the command succeeded, which means internet access is not properly disabled
      assert.fail('Expected command to fail when internet access is disabled')
    } catch (error) {
      // The command should fail or timeout when internet access is disabled
      assert.isTrue(error instanceof CommandExitError)
      assert.notEqual(error.exitCode, 0)
    }
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('internet access default', async () => {
  const sbx = await Sandbox.create(template)
  try {
    // Test internet connectivity by making a curl request to a reliable external site
    const result = await sbx.commands.run(
      "curl -s -o /dev/null -w '%{http_code}' https://e2b.dev"
    )
    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout.trim(), '200')
  } finally {
    await sbx.kill()
  }
})
