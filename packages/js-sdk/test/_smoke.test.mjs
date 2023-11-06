import { Sandbox } from '../src'
import { expect, test } from 'vitest'
import { id } from './setup.mjs'

// Smoke test = quick, high-level, basic functionality test
test.skip('Smoke test', async () => {
  const sandbox = await Sandbox.create({ id })
  await sandbox.filesystem.makeDir('/test/new')

  const ls = await sandbox.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['new'])

  await sandbox.close()
})
