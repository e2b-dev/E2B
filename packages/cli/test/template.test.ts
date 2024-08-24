import { test, expect, describe, vi, afterEach } from 'vitest'
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
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => {})

    afterEach(() => {
      consoleErrorSpy.mockClear()
      processExitSpy.mockClear()
    })

    test('should shapshot help on the build command', async () => {
      const output = await runCommandWithOutput(buildCommand, [
        'build',
        '--help',
      ])

      expect(stripAnsi(output as string)).toMatchSnapshot()
    })

    test('should print an error and exit if Docker is not installed', async () => {
      vi.spyOn(commandExists, 'sync').mockReturnValue(false)

      try {
        await buildCommand.parseAsync(['build'])

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Docker is required to build and push the sandbox template. Please install Docker and try again.'
        )
        expect(processExitSpy).toHaveBeenCalledWith(1)
      } finally {
        vi.spyOn(commandExists, 'sync').mockReturnValue(true)
      }
    })

    test('should print an error and exit if the name is invalid', async () => {
      const invalidName = '$$%%**'

      await buildCommand.parseAsync(['build', '--name', invalidName], {
        from: 'user',
      })

      const errorCalls = consoleErrorSpy.mock.calls
      const call = errorCalls[0][0]
      expect(stripAnsi(call)).toMatchInlineSnapshot(
        '"Name $$%%** is not valid. Name can only contain lowercase letters, numbers, dashes and underscores."'
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    test('should throw if access token not found', async () => {
      const oldEnv = process.env.E2B_ACCESS_TOKEN

      try {
        delete process.env.E2B_ACCESS_TOKEN

        const { ensureAccessToken } = await import('../src/api')
        ensureAccessToken()

        const errorCalls = consoleErrorSpy.mock.calls
        const call = stripAnsi(errorCalls[0][0])

        expect(call).toMatchSnapshot()

        expect(call).toContain(
          'You must be logged in to use this command. Run e2b auth login.'
        )
      } finally {
        process.env.E2B_ACCESS_TOKEN = oldEnv
      }
    })

    test('should throw if docker file not found', async () => {
      const name = 'somevalidname'
      const invalidPath = '/path/to/Dockerfile'

      await buildCommand.parseAsync(
        ['build', '--name', name, '--dockerfile', invalidPath],
        {
          from: 'user',
        }
      )

      const errorCalls = consoleErrorSpy.mock.calls
      const call = errorCalls[0][0]
      const error = call as Error
      expect(stripAnsi(error.message)).toMatchInlineSnapshot('"No ./path/to/Dockerfile found in the root directory."')

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
