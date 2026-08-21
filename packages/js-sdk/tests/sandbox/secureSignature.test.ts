import { assert, test } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'

import { getSignature } from '../../src'

/**
 * `getSignature` derives the signature locally from the path, operation, user
 * and envd access token — no sandbox involved, so this stays in the unit tier
 * next to the e2e `secure.test.ts`.
 */

test('signing generation', async () => {
  const operation = 'read'
  const path = '/home/user/hello.txt'
  const user = 'root'
  const envdAccessToken = randomUUID()

  const signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}`

  const buff = Buffer.from(signatureRaw, 'utf8')
  const hash = createHash('sha256').update(buff).digest()
  const signature = 'v1_' + hash.toString('base64').replace(/=+$/, '')

  const readSignatureExpected = {
    signature: signature,
    expiration: null,
  }

  const readSignatureReceived = await getSignature({
    path,
    operation,
    user,
    envdAccessToken,
  })

  assert.deepEqual(readSignatureExpected, readSignatureReceived)
})

test('signing generation with expiration', async () => {
  const operation = 'read'
  const path = '/home/user/hello.txt'
  const user = 'root'
  const envdAccessToken = randomUUID()
  const expirationInSeconds = 120

  const signatureExpiration =
    Math.floor(Date.now() / 1000) + expirationInSeconds
  const signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}:${signatureExpiration.toString()}`

  const buff = Buffer.from(signatureRaw, 'utf8')
  const hash = createHash('sha256').update(buff).digest()
  const signature = 'v1_' + hash.toString('base64').replace(/=+$/, '')

  const readSignatureExpected = {
    signature: signature,
    expiration: signatureExpiration,
  }

  const readSignatureReceived = await getSignature({
    path,
    operation,
    user,
    envdAccessToken,
    expirationInSeconds,
  })

  assert.deepEqual(readSignatureExpected, readSignatureReceived)
})

test('static signing key comparison', async () => {
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
