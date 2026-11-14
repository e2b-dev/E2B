import { expect, test } from 'vitest'

import { Sandbox } from '../src'

class FakeCommands {
  ran: string[] = []
  async run(command: string) {
    this.ran.push(command)
    return { stdout: '', exitCode: 0 }
  }
}

function sandboxWithFakeCommands(): { sandbox: any; ran: string[] } {
  const sandbox = Object.create(Sandbox.prototype) as any
  const commands = new FakeCommands()
  sandbox.commands = commands
  return { sandbox, ran: commands.ran }
}

test('click at an origin-side coordinate moves before clicking', async () => {
  const { sandbox, ran } = sandboxWithFakeCommands()
  await sandbox.leftClick(0, 100)
  expect(ran).toEqual(['xdotool mousemove --sync 0 100', 'xdotool click 1'])
})

test('click without coordinates does not move', async () => {
  const { sandbox, ran } = sandboxWithFakeCommands()
  await sandbox.leftClick()
  expect(ran).toEqual(['xdotool click 1'])
})

test.each([
  ['leftClick', 'xdotool click 1'],
  ['doubleClick', 'xdotool click --repeat 2 1'],
  ['rightClick', 'xdotool click 3'],
  ['middleClick', 'xdotool click 2'],
])('%s at (0, 0) moves to the origin', async (method, clickCommand) => {
  const { sandbox, ran } = sandboxWithFakeCommands()
  await sandbox[method](0, 0)
  expect(ran).toEqual(['xdotool mousemove --sync 0 0', clickCommand])
})

test('passing only one coordinate is rejected', async () => {
  const { sandbox, ran } = sandboxWithFakeCommands()
  await expect(sandbox.leftClick(5)).rejects.toThrow(
    'Pass both `x` and `y` to click at a position, or neither to click at the current cursor position.'
  )
  await expect(sandbox.rightClick(undefined, 7)).rejects.toThrow(
    'Pass both `x` and `y` to click at a position, or neither to click at the current cursor position.'
  )
  expect(ran).toEqual([])
})
