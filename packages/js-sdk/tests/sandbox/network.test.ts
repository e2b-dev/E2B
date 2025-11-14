import { assert, expect, describe } from 'vitest'

import { CommandExitError, ALL_TRAFFIC } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

describe('allow only 1.1.1.1', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        denyOut: [ALL_TRAFFIC],
        allowOut: ['1.1.1.1'],
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'allow specific IP with deny all traffic',
    async ({ sandbox }) => {
      // Test that allowed IP works
      const result = await sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
      )
      assert.equal(result.exitCode, 0)
      assert.equal(result.stdout.trim(), '301')

      // Test that other IPs are denied
      await expect(
        sandbox.commands.run(
          'curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8'
        )
      ).rejects.toBeInstanceOf(CommandExitError)
    }
  )
})

describe('deny specific IP address', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        denyOut: ['8.8.8.8'],
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'deny specific IP address',
    async ({ sandbox }) => {
      // Test that denied IP fails
      await expect(
        sandbox.commands.run(
          'curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8'
        )
      ).rejects.toBeInstanceOf(CommandExitError)

      // Test that other IPs work
      const result = await sandbox.commands.run(
        "curl -s -o /dev/null -w '%{http_code}' https://1.1.1.1"
      )
      assert.equal(result.exitCode, 0)
      assert.equal(result.stdout.trim(), '301')
    }
  )
})

describe('deny all traffic using allTraffic helper', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        denyOut: [ALL_TRAFFIC],
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'deny all traffic using allTraffic helper',
    async ({ sandbox }) => {
      // Test that all traffic is denied
      await expect(
        sandbox.commands.run(
          'curl --connect-timeout 3 --max-time 5 -Is https://1.1.1.1'
        )
      ).rejects.toBeInstanceOf(CommandExitError)

      await expect(
        sandbox.commands.run(
          'curl --connect-timeout 3 --max-time 5 -Is https://8.8.8.8'
        )
      ).rejects.toBeInstanceOf(CommandExitError)
    }
  )
})

describe('allow takes precedence over deny', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        denyOut: [ALL_TRAFFIC],
        allowOut: ['1.1.1.1', '8.8.8.8'],
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'allow takes precedence over deny',
    async ({ sandbox }) => {
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
      assert.equal(result2.stdout.trim(), '302')
    }
  )
})
