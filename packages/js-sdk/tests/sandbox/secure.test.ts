import { assert, test, describe, vi } from 'vitest'
import { getSignature, Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup'

/**
 * Recomputes the signature envd expects, independently of the SDK's own
 * implementation. WebCrypto rather than node:crypto so the expectation is
 * computed the same way on every runtime the suite covers.
 */
async function expectedSignature(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw)
  )
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return 'v1_' + base64.replace(/=+$/, '')
}

describe('secure sandbox', () => {
  sandboxTest.skipIf(isDebug)(
    'test access file with signing',
    async ({ sandbox }) => {
      await sandbox.files.write('hello.txt', 'hello world')

      const fileUrlWithSigning = await sandbox.downloadUrl('hello.txt')

      const res = await fetch(fileUrlWithSigning)
      const resBody = await res.text()
      const resStatus = res.status

      assert.equal(resStatus, 200)
      assert.equal(resBody, 'hello world')
    }
  )

  sandboxTest.skipIf(isDebug)(
    'try to re-connect to sandbox',
    async ({ sandbox }) => {
      const sbxReconnect = await Sandbox.connect(sandbox.sandboxId)

      await sbxReconnect.files.write('hello.txt', 'hello world')
    }
  )
})

test.skipIf(isDebug)('signing generation with expiration', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    // 2025-01-01T00:00:00Z
    vi.setSystemTime(1_735_689_600_000)

    const signatureReceived = await getSignature({
      path: 'hello.txt',
      operation: 'read',
      user: 'user',
      envdAccessToken: '0tQG31xiMp0IOQfaz9dcwi72L1CPo8e0',
      expirationInSeconds: 120,
    })

    assert.deepEqual(signatureReceived, {
      signature: 'v1_FE/lOUMhrUNLxwaTbOgRjjkrNMpmHDKS+wJXMTAM82o',
      expiration: 1_735_689_720,
    })
  } finally {
    vi.useRealTimers()
  }
})

test.skipIf(isDebug)('static signing key comparison', async () => {
  const operation = 'read'
  const path = 'hello.txt'
  const user = 'user'
  const envdAccessToken = '0tQG31xiMp0IOQfaz9dcwi72L1CPo8e0'

  const signatureReceived = await getSignature({
    path,
    operation,
    user,
    envdAccessToken,
  })

  assert.equal(
    'v1_gUtH/s9YCJWgCizjfUxuWfhFE4QSydOWEIIvfLwDr6E',
    signatureReceived.signature
  )
})
