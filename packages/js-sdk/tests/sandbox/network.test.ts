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

describe('allowPublicTraffic=false', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        allowPublicTraffic: false,
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'sandbox requires traffic access token',
    async ({ sandbox }) => {
      // Verify the sandbox was created successfully and has a traffic access token
      assert(sandbox.trafficAccessToken)

      // Start a simple HTTP server in the sandbox
      const port = 8080
      sandbox.commands.run(`python3 -m http.server ${port}`, {
        background: true,
      })

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Get the public URL for the sandbox
      const sandboxUrl = `https://${sandbox.getHost(port)}`

      // Test 1: Request without traffic access token should fail with 403
      const response1 = await fetch(sandboxUrl)
      assert.equal(response1.status, 403)

      // Test 2: Request with valid traffic access token should succeed
      const response2 = await fetch(sandboxUrl, {
        headers: {
          'e2b-traffic-access-token': sandbox.trafficAccessToken,
        },
      })
      assert.equal(response2.status, 200)
    }
  )
})

describe('allowPublicTraffic=true', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        allowPublicTraffic: true,
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'sandbox works without token',
    async ({ sandbox }) => {
      // Start a simple HTTP server in the sandbox
      const port = 8080
      sandbox.commands.run(`python3 -m http.server ${port}`, {
        background: true,
      })

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Get the public URL for the sandbox
      const sandboxUrl = `https://${sandbox.getHost(port)}`

      // Request without traffic access token should succeed (public access enabled)
      const response = await fetch(sandboxUrl)
      assert.equal(response.status, 200)
    }
  )
})

describe('maskRequestHost option', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      network: {
        maskRequestHost: 'custom-host.example.com:${PORT}',
      },
    },
  })

  sandboxTest.skipIf(isDebug)(
    'verify maskRequestHost modifies Host header correctly',
    async ({ sandbox }) => {
      // Install netcat for testing
      await sandbox.commands.run('apt-get update', { user: 'root' })
      await sandbox.commands.run('apt-get install -y netcat-traditional', {
        user: 'root',
      })

      const port = 8080
      const outputFile = '/tmp/nc_output.txt'

      // Start netcat listener in background to capture request headers
      sandbox.commands.run(`nc -l -p ${port} > ${outputFile}`, {
        background: true,
        user: 'root',
      })

      // Wait for netcat to start
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Get the public URL for the sandbox
      const sandboxUrl = `https://${sandbox.getHost(port)}`

      // Make a request from OUTSIDE the sandbox through the proxy
      // The Host header should be modified according to maskRequestHost
      try {
        await fetch(sandboxUrl, { signal: AbortSignal.timeout(5000) })
      } catch (error) {
        // Request may fail since netcat doesn't respond properly, but headers are captured
      }

      // Read the captured output from inside the sandbox
      const result = await sandbox.commands.run(`cat ${outputFile}`, {
        user: 'root',
      })

      // Verify the Host header was modified according to maskRequestHost
      assert.include(result.stdout, 'Host:')
      assert.include(result.stdout, 'custom-host.example.com')
      assert.include(result.stdout, `${port}`)
    }
  )
})
