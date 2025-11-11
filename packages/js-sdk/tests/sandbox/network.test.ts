import { assert } from 'vitest'

import { CommandExitError, allTraffic } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest
  .extend({
    sandboxOpts: {
      network: {
        denyOut: [allTraffic()],
        allowOut: ['1.1.1.1'],
      },
    },
  })
  .skipIf(isDebug)(
  'allow specific IP with deny all traffic',
  async ({ sandbox }) => {
    // Test that allowed IP works
    const result = await sandbox.commands.run(
      "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
    )
    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout.trim(), '301')

    // Test that other IPs are denied
    try {
      await sandbox.commands.run(
        'curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8'
      )
      assert.fail('Expected command to fail for non-allowed IP')
    } catch (error) {
      assert.isTrue(error instanceof CommandExitError)
      assert.notEqual(error.exitCode, 0)
    }
  }
)

sandboxTest
  .extend({
    sandboxOpts: {
      network: {
        denyOut: ['8.8.8.8'],
      },
    },
  })
  .skipIf(isDebug)('deny specific IP address', async ({ sandbox }) => {
  // Test that denied IP fails
  try {
    await sandbox.commands.run(
      'curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8'
    )
    assert.fail('Expected command to fail for denied IP')
  } catch (error) {
    assert.isTrue(error instanceof CommandExitError)
    assert.notEqual(error.exitCode, 0)
  }

  // Test that other IPs work
  const result = await sandbox.commands.run(
    "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
  )
  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout.trim(), '301')
})

sandboxTest
  .extend({
    sandboxOpts: {
      network: {
        denyOut: [allTraffic()],
      },
    },
  })
  .skipIf(isDebug)(
  'deny all traffic using allTraffic helper',
  async ({ sandbox }) => {
    // Test that all traffic is denied
    try {
      await sandbox.commands.run(
        'curl --connect-timeout 3 --max-time 5 -Is https://1.1.1.1'
      )
      assert.fail('Expected command to fail when all traffic is denied')
    } catch (error) {
      assert.isTrue(error instanceof CommandExitError)
      assert.notEqual(error.exitCode, 0)
    }

    try {
      await sandbox.commands.run(
        'curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8'
      )
      assert.fail('Expected command to fail when all traffic is denied')
    } catch (error) {
      assert.isTrue(error instanceof CommandExitError)
      assert.notEqual(error.exitCode, 0)
    }
  }
)

sandboxTest
  .extend({
    sandboxOpts: {
      network: {
        denyOut: [allTraffic()],
        allowOut: ['1.1.1.1', '8.8.8.8'],
      },
    },
  })
  .skipIf(isDebug)('allow takes precedence over deny', async ({ sandbox }) => {
  // Test that 1.1.1.1 works (explicitly allowed)
  const result1 = await sandbox.commands.run(
    "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
  )
  assert.equal(result1.exitCode, 0)
  assert.equal(result1.stdout.trim(), '301')

  // Test that 8.8.8.8 also works (explicitly allowed, takes precedence over denyOut)
  const result2 = await sandbox.commands.run(
    "curl -s -o /dev/null -w '%{http_code}' https://8.8.8.8"
  )
  assert.equal(result2.exitCode, 0)
  assert.equal(result2.stdout.trim(), '301')
})
