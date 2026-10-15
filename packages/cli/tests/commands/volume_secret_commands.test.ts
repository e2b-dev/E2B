import { Command } from 'commander'
import { describe, expect, test } from 'vitest'

import { volumeCommand } from '../../src/commands/volume'
import { secretCommand } from '../../src/commands/secret'

// Verifies the volume and secret resource subcommands are wired into their
// command trees with the operations the SDK exposes. We import the command
// groups directly (rather than the top-level `program`) to avoid pulling in
// `src/index.ts`, which reads `package.json` at import time and is not set up
// under vitest. No backend connection — this only inspects the commander tree.

describe('volume CLI subcommands', () => {
  test('exposes create/list/info/delete', () => {
    expect(volumeCommand.commands.map((c: Command) => c.name()).sort()).toEqual(
      ['create', 'delete', 'info', 'list']
    )
  })

  test('list is aliased to ls', () => {
    const list = volumeCommand.commands.find((c: Command) => c.name() === 'list')!
    expect(list.aliases()).toContain('ls')
  })

  test('delete is aliased to rm', () => {
    const del = volumeCommand.commands.find(
      (c: Command) => c.name() === 'delete'
    )!
    expect(del.aliases()).toContain('rm')
  })
})

describe('secret CLI subcommands', () => {
  test('exposes create/list/info/update/delete', () => {
    expect(secretCommand.commands.map((c: Command) => c.name()).sort()).toEqual([
      'create',
      'delete',
      'info',
      'list',
      'update',
    ])
  })

  test('delete is aliased to rm', () => {
    const del = secretCommand.commands.find(
      (c: Command) => c.name() === 'delete'
    )!
    expect(del.aliases()).toContain('rm')
  })

  test('create requires --value and notes it is write-only', () => {
    const create = secretCommand.commands.find(
      (c: Command) => c.name() === 'create'
    )!

    expect(create.options.map((o: { long?: string }) => o.long)).toContain(
      '--value'
    )
    expect(create.helpInformation()).toContain('write-only')
  })
})
