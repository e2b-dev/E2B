import { assert, test } from 'vitest'

import { Sandbox } from '../../../src'
import { template, isDebug } from '../../setup'

const timeout = 20 * 1000

test.skipIf(isDebug)('test access file with expired signing', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  await sbx.files.write('hello.txt', 'hello world')

  const fileUrlWithSigning = await sbx.downloadUrl('hello.txt', {
    useSignatureExpiration: -10_000,
  })

  const res = await fetch(fileUrlWithSigning)
  const resBody = await res.text()
  const resStatus = res.status

  assert.equal(resStatus, 401)
  assert.deepEqual(JSON.parse(resBody), {
    code: 401,
    message: 'signature is already expired',
  })

  await sbx.kill()
})

test.skipIf(isDebug)('test access file with valid signing', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  await sbx.files.write('hello.txt', 'hello world')

  const fileUrlWithSigning = await sbx.downloadUrl('hello.txt', {
    useSignatureExpiration: 10_000,
  })

  const res = await fetch(fileUrlWithSigning)
  const resBody = await res.text()
  const resStatus = res.status

  assert.equal(resStatus, 200)
  assert.equal(resBody, 'hello world')

  await sbx.kill()
})

test.skipIf(isDebug)(
  'test access file with valid signing as root',
  async () => {
    const sbx = await Sandbox.create(template, {
      timeoutMs: timeout,
      secure: true,
    })
    await sbx.files.write('hello.txt', 'hello world', { user: 'root' })

    const fileUrlWithSigning = await sbx.downloadUrl('hello.txt', {
      user: 'root',
      useSignatureExpiration: 10_000,
    })

    const res = await fetch(fileUrlWithSigning)
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 200)
    assert.equal(resBody, 'hello world')

    await sbx.kill()
  }
)

test.skipIf(isDebug)('test upload file with valid signing', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  const fileUrlWithSigning = await sbx.uploadUrl('hello.txt', {
    useSignatureExpiration: 10_000,
  })

  const form = new FormData()
  form.append('file', 'file content')

  const res = await fetch(fileUrlWithSigning, { method: 'POST', body: form })
  const resBody = await res.text()
  const resStatus = res.status

  assert.equal(resStatus, 200)
  assert.deepEqual(JSON.parse(resBody), [
    { name: 'hello.txt', path: '/home/user/hello.txt', type: 'file' },
  ])

  await sbx.kill()
})

test.skipIf(isDebug)(
  'test upload file with valid signing as root user',
  async () => {
    const sbx = await Sandbox.create(template, {
      timeoutMs: timeout,
      secure: true,
    })

    const fileUrlWithSigning = await sbx.uploadUrl('hello.txt', {
      user: 'root',
      useSignatureExpiration: 10_000,
    })

    const form = new FormData()
    form.append('file', 'file content')

    const res = await fetch(fileUrlWithSigning, { method: 'POST', body: form })
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 200)
    assert.deepEqual(JSON.parse(resBody), [
      { name: 'hello.txt', path: '/root/hello.txt', type: 'file' },
    ])

    await sbx.kill()
  }
)

test.skipIf(isDebug)('test upload file with invalid signing', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  const fileUrlWithSigning = await sbx.uploadUrl('hello.txt', {
    useSignatureExpiration: -100_000,
  })

  const form = new FormData()
  form.append('file', 'file content')

  const res = await fetch(fileUrlWithSigning, { method: 'POST', body: form })
  const resBody = await res.text()
  const resStatus = res.status

  assert.equal(resStatus, 401)
  assert.deepEqual(JSON.parse(resBody), {
    code: 401,
    message: 'signature is already expired',
  })

  await sbx.kill()
})

test.skipIf(isDebug)('test command run with secured sbx', async () => {
  const sbx = await Sandbox.create(template, {
    timeoutMs: timeout,
    secure: true,
  })
  const response = await sbx.commands.run('echo Hello World!')

  assert.equal(response.stdout, 'Hello World!\n')
})
