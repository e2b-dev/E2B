import { expect, test } from 'vitest'

import { Sandbox } from '../src'

function sandboxWithStdout(stdout: string): { sandbox: any } {
  const sandbox = Object.create(Sandbox.prototype) as any
  sandbox.commands = {
    run: async () => ({ stdout, exitCode: 0 }),
  }
  return { sandbox }
}

test('no matching window yields an empty list', async () => {
  const { sandbox } = sandboxWithStdout('')
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([])
})

test('whitespace-only output yields an empty list', async () => {
  const { sandbox } = sandboxWithStdout('\n  \n')
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([])
})

test('one window id per non-empty line', async () => {
  const { sandbox } = sandboxWithStdout('65011712\n65011744\n')
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([
    '65011712',
    '65011744',
  ])
})

test('blank lines between ids are dropped', async () => {
  const { sandbox } = sandboxWithStdout('65011712\n\n 65011744 \n')
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([
    '65011712',
    '65011744',
  ])
})
