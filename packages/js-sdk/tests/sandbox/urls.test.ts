import { assert, describe, test } from 'vitest'

import { getSignature, InvalidArgumentError, Sandbox } from '../../src'
import { TEST_API_KEY } from '../setup'

function createSandbox(envdAccessToken?: string) {
  return new Sandbox({
    sandboxId: 'sandbox-id',
    sandboxDomain: 'e2b.app',
    envdVersion: '0.4.0',
    envdAccessToken,
    apiKey: TEST_API_KEY,
    domain: 'e2b.app',
    debug: false,
  })
}

describe('sandbox file URLs', () => {
  test('file URLs use direct sandbox host when envd API uses stable host', async () => {
    const sandbox = createSandbox()

    assert.equal(sandbox['envdApiUrl'], 'https://sandbox.e2b.app')
    assert.equal(sandbox['envdDirectUrl'], 'https://49983-sandbox-id.e2b.app')
    assert.equal(
      await sandbox.downloadUrl('/tmp/a.txt'),
      'https://49983-sandbox-id.e2b.app/files?path=%2Ftmp%2Fa.txt'
    )
    assert.equal(
      await sandbox.uploadUrl('/tmp/a.txt'),
      'https://49983-sandbox-id.e2b.app/files?path=%2Ftmp%2Fa.txt'
    )
  })

  test('throws when signature expiration is used on unsecured sandbox', async () => {
    const sandbox = createSandbox()

    await Promise.all(
      [
        sandbox.downloadUrl('/tmp/a.txt', { useSignatureExpiration: 120 }),
        sandbox.uploadUrl('/tmp/a.txt', { useSignatureExpiration: 120 }),
      ].map((promise) =>
        promise.then(
          () => assert.fail('expected InvalidArgumentError'),
          (err) => {
            assert.instanceOf(err, InvalidArgumentError)
            assert.equal(
              err.message,
              'Signature expiration can be used only when sandbox is created as secured.'
            )
          }
        )
      )
    )
  })

  test('zero signature expiration expires immediately', async () => {
    const before = Math.floor(Date.now() / 1000)

    const signature = await getSignature({
      path: '/tmp/a.txt',
      operation: 'read',
      user: 'user',
      envdAccessToken: 'access-token',
      expirationInSeconds: 0,
    })

    const after = Math.floor(Date.now() / 1000)

    assert.isNotNull(signature.expiration)
    assert.isAtLeast(signature.expiration!, before)
    assert.isAtMost(signature.expiration!, after)
  })

  test('zero signature expiration is included in URL', async () => {
    const sandbox = createSandbox('access-token')

    for (const url of [
      await sandbox.downloadUrl('/tmp/a.txt', { useSignatureExpiration: 0 }),
      await sandbox.uploadUrl('/tmp/a.txt', { useSignatureExpiration: 0 }),
    ]) {
      const expiration = new URL(url).searchParams.get('signature_expiration')
      assert.isNotNull(expiration)
      assert.approximately(
        parseInt(expiration!),
        Math.floor(Date.now() / 1000),
        5
      )
    }
  })
})
