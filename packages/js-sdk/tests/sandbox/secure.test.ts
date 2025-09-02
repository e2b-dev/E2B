import { assert, test } from 'vitest'
import { getSignature, Sandbox } from '../../src'
import { isDebug, template } from '../setup'
import { randomUUID, createHash } from 'node:crypto'

const timeout = 20 * 1000

test.skipIf(isDebug)('test access file with signing', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  await sbx.files.write('hello.txt', 'hello world')

  const fileUrlWithSigning = await sbx.downloadUrl('hello.txt')

  const res = await fetch(fileUrlWithSigning)
  const resBody = await res.text()
  const resStatus = res.status

  assert.equal(resStatus, 200)
  assert.equal(resBody, 'hello world')

  await sbx.kill()
})

test.skipIf(isDebug)('try to re-connect to sandbox', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  const sbxReconnect = await Sandbox.connect(sbx.sandboxId)

  await sbxReconnect.files.write('hello.txt', 'hello world')
  await sbxReconnect.kill()
})

test.skipIf(isDebug)('signing generation', async () => {
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

test.skipIf(isDebug)('signing generation with expiration', async () => {
  const operation = 'read'
  const path = '/home/user/hello.txt'
  const user = 'root'
  const envdAccessToken = randomUUID()
  const expirationInSeconds = 120

  const signatureExpiration = expirationInSeconds
    ? Math.floor(Date.now() / 1000) + expirationInSeconds
    : null
  const signatureRaw = `${path}:${operation}:${user}:${envdAccessToken}:${signatureExpiration?.toString()}`

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
