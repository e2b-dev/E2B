import { assert, describe } from 'vitest'
import { Sandbox } from '../../src'
import { hostedSandboxTest, sandboxTest } from '../setup'

describe('secure sandbox', () => {
  sandboxTest.override({
    sandboxOpts: {
      secure: true,
    },
  })

  hostedSandboxTest('test access file with signing', async ({ sandbox }) => {
    await sandbox.files.write('hello.txt', 'hello world')

    const fileUrlWithSigning = await sandbox.downloadUrl('hello.txt')

    const res = await fetch(fileUrlWithSigning)
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 200)
    assert.equal(resBody, 'hello world')
  })

  hostedSandboxTest('try to re-connect to sandbox', async ({ sandbox }) => {
    const sbxReconnect = await Sandbox.connect(sandbox.sandboxId)

    await sbxReconnect.files.write('hello.txt', 'hello world')
  })
})
