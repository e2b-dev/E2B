import { Session } from '../src'
import { expect, test } from 'vitest'

import { id } from './setup.mjs'

test('test_env_vars', async () => {
  const session = await Session.create({ id })

  const process = await session.process.start({
    cmd: 'echo $FOO',
    envVars: { FOO: 'BAR' },
  })
  await process.finished
  const output = process.output.stdout
  expect(output).toEqual('BAR')

  await session.close()
})

test('test_profile_env_vars', async () => {
  const session = await Session.create({ id })

  await session.filesystem.write('/home/user/.profile', 'export FOO=BAR')
  const process = await session.process.start({ cmd: 'echo $FOO' })
  await process.finished
  const output = process.output.stdout
  expect(output).toEqual('BAR')

  await session.close()
})

test('test_default_env_vars', async () => {
  const session = await Session.create({ id, envVars: { FOO: 'BAR' } })

  const process = await session.process.start({ cmd: 'echo $FOO' })
  await process.finished
  const output = process.output.stdout
  expect(output).toEqual('BAR')

  await session.close()
})

test('test_overriding_env_vars', async () => {
  const session = await Session.create({ id, envVars: { FOO: 'BAR' } })

  const process = await session.process.start({
    cmd: 'echo $FOO',
    envVars: { FOO: 'QUX' },
  })
  await process.finished
  const output = process.output.stdout
  expect(output).toEqual('QUX')

  await session.close()
})
