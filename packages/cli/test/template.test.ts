import { test, expect, describe, vi, afterEach } from 'vitest'
import { buildCommand } from 'src/commands/template/build'
import commandExists from 'command-exists'
import stripAnsi from 'strip-ansi'
import path from 'path'
import * as buildUtils from '../src/commands/template/utils'
import * as fs from 'fs'
import * as config from 'src/config'
import * as dockerCommands from 'src/docker/commands'

describe('template build', () => {
  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => {})

  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})

  afterEach(() => {
    consoleErrorSpy.mockClear()
    processExitSpy.mockClear()
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
    expect(stripAnsi(error.message)).toMatchInlineSnapshot(
      '"No ./path/to/Dockerfile found in the root directory."'
    )

    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  test('should perform a build', async () => {
    const name = 'somevalidname'
    const requestBuildTemplateMock = vi
      .spyOn(buildUtils, 'requestBuildTemplate')
      .mockReturnValue({ templateID: '123' })
    const saveConfigMock = vi.spyOn(config, 'saveConfig').mockReturnValue({})
    const dockerConnectMock = vi
      .spyOn(dockerCommands, 'dockerConnect')
      .mockReturnValue({})
    const dockerBuildMock = vi
      .spyOn(dockerCommands, 'dockerBuild')
      .mockReturnValue({})
    const pushDockerImageMock = vi
      .spyOn(dockerCommands, 'pushDockerImage')
      .mockReturnValue({})
    const triggerBuildMock = vi
      .spyOn(buildUtils, 'triggerBuild')
      .mockReturnValue({})

    const validPath = path.join(
      '../',
      'testground',
      'demo-basic',
      'Dockerfile'
    )

    await buildCommand.parseAsync(
      ['build', '--name', name, '--dockerfile', validPath, '--path', __dirname],
      {
        from: 'user',
      }
    )

    const dockerfile = await fs.readFileSync(
      path.join(__dirname, validPath),
      'utf-8'
    )

    expect(requestBuildTemplateMock).toHaveBeenCalledWith(
      process.env.E2B_ACCESS_TOKEN,
      {
        alias: name,
        cpuCount: undefined,
        dockerfile,
        memoryMB: undefined,
        startCmd: undefined,
        teamID: undefined,
      },
      false,
      'e2b.toml',
      'build'
    )

    expect(saveConfigMock).toHaveBeenCalled()

    expect(dockerConnectMock).toHaveBeenCalledWith({
      accessToken: process.env.E2B_ACCESS_TOKEN,
    })

    expect(dockerBuildMock).toHaveBeenCalled()

    expect(pushDockerImageMock).toHaveBeenCalledWith({
      accessToken: process.env.E2B_ACCESS_TOKEN,
      tag: 'docker.e2b.dev/e2b/custom-envs/123:undefined',
    })

    expect(triggerBuildMock).toHaveBeenCalled()
  })
})
