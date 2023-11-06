import { Sandbox } from '../src'
import { expect, test } from 'vitest'

import { id } from './setup.mjs'

test('test_env_vars', async () => {
  const sandbox = await Sandbox.create({ id })

  const process = await sandbox.process.start({
    cmd: 'echo $FOO',
    envVars: { FOO: 'BAR' }
  })
  await process.wait()
  const output = process.output.stdout
  expect(output).toEqual('BAR')

  await sandbox.close()
})

test('test_profile_env_vars', async () => {
  const sandbox = await Sandbox.create({ id })

  await sandbox.filesystem.write('/home/user/.profile', 'export FOO=BAR')
  const process = await sandbox.process.start({ cmd: 'echo $FOO' })
  await process.wait()
  const output = process.output.stdout
  expect(output).toEqual('BAR')

  await sandbox.close()
})

test('test_default_env_vars', async () => {
  const sandbox = await Sandbox.create({ id, envVars: { FOO: 'BAR' } })

  const process = await sandbox.process.start({ cmd: 'echo $FOO' })
  await process.wait()
  const output = process.output.stdout
  expect(output).toEqual('BAR')

  await sandbox.close()
})

test('test_overriding_env_vars', async () => {
  const sandbox = await Sandbox.create({ id, envVars: { FOO: 'BAR' } })

  const process = await sandbox.process.start({
    cmd: 'echo $FOO',
    envVars: { FOO: 'QUX' }
  })
  await process.wait()
  const output = process.output.stdout
  expect(output).toEqual('QUX')

  await sandbox.close()
})
