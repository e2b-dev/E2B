import { test, expect, describe, vi } from 'vitest'
import { templateCommand } from '../src/commands/template'
import { runCommandWithOutput } from './run-command'
import { buildCommand } from 'src/commands/template/build'
import commandExists from 'command-exists'
import stripAnsi from 'strip-ansi'

describe('template', () => {
  test('should snapshot the --help output', async () => {
    const output = await runCommandWithOutput(templateCommand, [
      'template',
      '--help',
    ])

    expect(stripAnsi(output as string)).toMatchSnapshot()
  })

  describe('template build', () => {
    test('should shapshot help on the build command', async () => {
      const output = await runCommandWithOutput(buildCommand, [
        'build',
        '--help',
      ])

      expect(stripAnsi(output as string)).toMatchSnapshot()
    })

    test('should print an error and exit if Docker is not installed', async () => {
      vi.spyOn(commandExists, 'sync').mockReturnValue(false)

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const processExitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => {})

      await buildCommand.parseAsync(['build'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Docker is required to build and push the sandbox template. Please install Docker and try again.'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
      processExitSpy.mockRestore()

      vi.spyOn(commandExists, 'sync').mockReturnValue(true)
    })

    test('should print an error and exit if the name is invalid', async () => {
      const invalidName = '$$%%**'

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const processExitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => {})

      await buildCommand.parseAsync(['build', '--name', invalidName], {
        from: 'user',
      })

      const errorCalls = consoleErrorSpy.mock.calls
      const call = errorCalls[0][0]
      expect(stripAnsi(call)).toMatchInlineSnapshot(
        '"Name $$%%** is not valid. Name can only contain lowercase letters, numbers, dashes and underscores."'
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
      processExitSpy.mockRestore()
    })
  })
})
