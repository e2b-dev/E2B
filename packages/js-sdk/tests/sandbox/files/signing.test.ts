import { assert, describe } from 'vitest'

import { sandboxTest, isDebug } from '../../setup'

describe('file signing', () => {
  sandboxTest.scoped({
    sandboxOpts: {
      secure: true,
    },
  })

  sandboxTest.skipIf(isDebug)(
    'test access file with expired signing',
    async ({ sandbox }) => {
      await sandbox.files.write('hello.txt', 'hello world')

      const fileUrlWithSigning = await sandbox.downloadUrl('hello.txt', {
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
    }
  )

  sandboxTest.skipIf(isDebug)(
    'test access file with valid signing',
    async ({ sandbox }) => {
      await sandbox.files.write('hello.txt', 'hello world')

      const fileUrlWithSigning = await sandbox.downloadUrl('hello.txt', {
        useSignatureExpiration: 10_000,
      })

      const res = await fetch(fileUrlWithSigning)
      const resBody = await res.text()
      const resStatus = res.status

      assert.equal(resStatus, 200)
      assert.equal(resBody, 'hello world')
    }
  )

  sandboxTest.skipIf(isDebug)(
    'test access file with valid signing as root',
    async ({ sandbox }) => {
      await sandbox.files.write('hello.txt', 'hello world', { user: 'root' })

      const fileUrlWithSigning = await sandbox.downloadUrl('hello.txt', {
        user: 'root',
        useSignatureExpiration: 10_000,
      })

      const res = await fetch(fileUrlWithSigning)
      const resBody = await res.text()
      const resStatus = res.status

      assert.equal(resStatus, 200)
      assert.equal(resBody, 'hello world')
    }
  )

  sandboxTest.skipIf(isDebug)(
    'test upload file with valid signing',
    async ({ sandbox }) => {
      const fileUrlWithSigning = await sandbox.uploadUrl('hello.txt', {
        useSignatureExpiration: 10_000,
      })

      const form = new FormData()
      form.append('file', 'file content')

      const res = await fetch(fileUrlWithSigning, {
        method: 'POST',
        body: form,
      })
      const resBody = await res.text()
      const resStatus = res.status

      assert.equal(resStatus, 200)
      assert.deepEqual(JSON.parse(resBody), [
        { name: 'hello.txt', path: '/home/user/hello.txt', type: 'file' },
      ])
    }
  )

  sandboxTest.skipIf(isDebug)(
    'test upload file with valid signing as root user',
    async ({ sandbox }) => {
      const fileUrlWithSigning = await sandbox.uploadUrl('hello.txt', {
        user: 'root',
        useSignatureExpiration: 10_000,
      })

      const form = new FormData()
      form.append('file', 'file content')

      const res = await fetch(fileUrlWithSigning, {
        method: 'POST',
        body: form,
      })
      const resBody = await res.text()
      const resStatus = res.status

      assert.equal(resStatus, 200)
      assert.deepEqual(JSON.parse(resBody), [
        { name: 'hello.txt', path: '/root/hello.txt', type: 'file' },
      ])
    }
  )

  sandboxTest.skipIf(isDebug)(
    'test upload file with invalid signing',
    async ({ sandbox }) => {
      const fileUrlWithSigning = await sandbox.uploadUrl('hello.txt', {
        useSignatureExpiration: -100_000,
      })

      const form = new FormData()
      form.append('file', 'file content')

      const res = await fetch(fileUrlWithSigning, {
        method: 'POST',
        body: form,
      })
      const resBody = await res.text()
      const resStatus = res.status

      assert.equal(resStatus, 401)
      assert.deepEqual(JSON.parse(resBody), {
        code: 401,
        message: 'signature is already expired',
      })
    }
  )

  sandboxTest.skipIf(isDebug)(
    'test command run with secured sbx',
    async ({ sandbox }) => {
      const response = await sandbox.commands.run('echo Hello World!')

      assert.equal(response.stdout, 'Hello World!\n')
    }
  )
})
