import { expect, test } from 'vitest'

import { CommandExitError } from 'e2b'

import { Sandbox } from '../src'

type RunResult = { stdout: string; exitCode: number }

function sandboxWithRun(run: () => Promise<RunResult>): { sandbox: any } {
  const sandbox = Object.create(Sandbox.prototype) as any
  sandbox.commands = {
    run: async () => run(),
  }
  return { sandbox }
}

// Real xdotool behavior: a search with no match exits with status 1 and
// prints nothing on stdout.
function sandboxWithNoMatch(stdout = ''): { sandbox: any } {
  return sandboxWithRun(async () => {
    throw new CommandExitError({ exitCode: 1, stdout, stderr: '' })
  })
}

test('no matching window (xdotool exit 1 with empty stdout) yields an empty list', async () => {
  const { sandbox } = sandboxWithNoMatch()
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([])
})

test('no match with whitespace-only stdout yields an empty list', async () => {
  const { sandbox } = sandboxWithNoMatch('\n  \n')
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([])
})

test('one window id per non-empty line', async () => {
  const { sandbox } = sandboxWithRun(async () => ({
    stdout: '65011712\n65011744\n',
    exitCode: 0,
  }))
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([
    '65011712',
    '65011744',
  ])
})

test('blank lines between ids are dropped', async () => {
  const { sandbox } = sandboxWithRun(async () => ({
    stdout: '65011712\n\n 65011744 \n',
    exitCode: 0,
  }))
  await expect(sandbox.getApplicationWindows('firefox')).resolves.toEqual([
    '65011712',
    '65011744',
  ])
})

test('non-no-match failures still propagate', async () => {
  const { sandbox } = sandboxWithRun(async () => {
    throw new CommandExitError({
      exitCode: 2,
      stdout: '',
      stderr: 'xdotool: cannot open display',
    })
  })
  await expect(sandbox.getApplicationWindows('firefox')).rejects.toThrow(
    CommandExitError
  )
})
