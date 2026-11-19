import { expectTypeOf, test } from 'vitest'

import type { CommandStartOpts, Sandbox } from '../../../src/index.js'

declare const sandbox: Sandbox
declare const opts: CommandStartOpts

test('retained output types stdout as a string', async () => {
  expectTypeOf(
    (await sandbox.commands.run('echo')).stdout
  ).toEqualTypeOf<string>()
  expectTypeOf(
    (await sandbox.commands.run('echo', {})).stdout
  ).toEqualTypeOf<string>()
  expectTypeOf(
    (await sandbox.commands.run('echo', { retainOutput: true })).stdout
  ).toEqualTypeOf<string>()
})

test('retainOutput: false types stdout as undefined', async () => {
  expectTypeOf(
    (await sandbox.commands.run('echo', { retainOutput: false })).stdout
  ).toEqualTypeOf<undefined>()
  expectTypeOf(
    (
      await sandbox.commands.run('echo', {
        background: true,
        retainOutput: false,
      })
    ).stdout
  ).toEqualTypeOf<undefined>()
  expectTypeOf(
    (await sandbox.commands.connect(1, { retainOutput: false })).stdout
  ).toEqualTypeOf<undefined>()
})

test('non-literal retainOutput types stdout as possibly undefined', async () => {
  expectTypeOf((await sandbox.commands.run('echo', opts)).stdout).toEqualTypeOf<
    string | undefined
  >()
})
