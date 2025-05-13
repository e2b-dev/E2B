import {assert, test} from 'vitest'
import {Sandbox} from '../../src'
import {template} from '../setup'

const timeout = 20 * 1000

test('test access file without signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    await sbx.files.write('hello.txt', 'hello world')

    const fileUrlWithoutSigning = sbx.downloadUrl('hello.txt')

    const res = await fetch(fileUrlWithoutSigning)
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 401)
    assert.equal(JSON.parse(resBody), {code: 401, message: 'missing signature query parameter'})

    await sbx.kill()
})

test('test access file with signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    await sbx.files.write('hello.txt', 'hello world')

    const fileUrlWithSigning = sbx.downloadUrl('hello.txt', true)

    const res = await fetch(fileUrlWithSigning)
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 200)
    assert.equal(resBody, 'hello world')

    await sbx.kill()
})

test('try to re-connect to sandbox', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    const sbxReconnect = await Sandbox.connect(sbx.sandboxId)

    await sbxReconnect.files.write('hello.txt', 'hello world')
    await sbxReconnect.kill()
})
