import {assert, test} from 'vitest'
import {Sandbox} from '../../../src'
import {template} from '../../setup'

const timeout = 20 * 1000

test('test access file with expired signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    await sbx.files.write('hello.txt', 'hello world')

    const fileUrlWithSigning = sbx.downloadUrl('hello.txt', true, -10_000)

    const res = await fetch(fileUrlWithSigning)
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 401)
    assert.equal(JSON.parse(resBody), {code: 401, message: 'signature is already expired'})

    await sbx.kill()
})

test('test access file with valid signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    await sbx.files.write('hello.txt', 'hello world')

    const fileUrlWithSigning = sbx.downloadUrl('hello.txt', true, 10_000)

    const res = await fetch(fileUrlWithSigning)
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 200)
    assert.equal(resBody, 'hello world')

    await sbx.kill()
})

test('test upload file with valid signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    const fileUrlWithSigning = sbx.uploadUrl('hello.txt', true, 10_000)

    const form = new FormData()
    form.append('file', 'file content')

    const res = await fetch(fileUrlWithSigning, { method: 'POST', body: form })
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 200)
    assert.equal(JSON.parse(resBody), [{name: 'hello.txt', path: '/home/user/hello.txt', type: 'file'}])

    await sbx.kill()
})

test('test upload file with invalid signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    const fileUrlWithSigning = sbx.uploadUrl('hello.txt', true, -10_000)

    const form = new FormData()
    form.append('file', 'file content')

    const res = await fetch(fileUrlWithSigning, { method: 'POST', body: form })
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 401)
    assert.equal(JSON.parse(resBody), {code: 401, message: 'signature is already expired'})

    await sbx.kill()
})

test('test upload file with missing signing', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    const fileUrlWithSigning = sbx.uploadUrl('hello.txt')

    const form = new FormData()
    form.append('file', 'file content')

    const res = await fetch(fileUrlWithSigning, { method: 'POST', body: form })
    const resBody = await res.text()
    const resStatus = res.status

    assert.equal(resStatus, 401)
    assert.equal(JSON.parse(resBody), {code: 401, message: 'missing signature query parameter'})

    await sbx.kill()
})

test('test command run with secured sbx', async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: timeout, secure: true })
    const response = await sbx.commands.run('echo Hello World!')

    assert.equal(response.stdout, 'Hello World!\n')
})


