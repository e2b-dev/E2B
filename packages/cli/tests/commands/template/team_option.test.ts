import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createServer, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { bufferToText, runCli, runCliWithPipedStdin } from '../../setup'

const DUMMY_API_KEY = `e2b_${'0'.repeat(40)}`
const DEPRECATION_WARNING =
  "The '--team' option is deprecated and will be removed in future releases."

let server: Server
let apiUrl: string
const requestUrls: string[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    requestUrls.push(req.url ?? '')
    res.setHeader('Content-Type', 'application/json')
    res.end('[]')
  })
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve())
  )
  const { port } = server.address() as AddressInfo
  apiUrl = `http://127.0.0.1:${port}`
})

afterAll(() => {
  server.close()
})

function mockApiEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2B_API_URL: apiUrl,
    E2B_API_KEY: DUMMY_API_KEY,
  }
  delete env.E2B_DEBUG
  delete env.E2B_ACCESS_TOKEN
  delete env.E2B_TEAM_ID
  return env
}

describe('deprecated --team option', () => {
  // The CLI is spawned asynchronously (not with spawnSync) so the mock API
  // server on this event loop can answer its requests.
  test('template list --team prints a deprecation warning and ignores the flag', async () => {
    requestUrls.length = 0
    const result = await runCliWithPipedStdin(
      ['template', 'list', '--team', 'some-team-id'],
      Buffer.alloc(0),
      { timeoutMs: 30_000, env: mockApiEnv() }
    )

    const output =
      bufferToText(result.stdout) + bufferToText(result.stderr)
    expect(output).toContain(DEPRECATION_WARNING)
    expect(output).not.toContain('unknown option')
    expect(result.status).toBe(0)

    // The flag is a no-op: the request is scoped by the API key, so no
    // teamID query param is sent.
    const templatesRequest = requestUrls.find((url) =>
      url.includes('/templates')
    )
    expect(templatesRequest).toBeDefined()
    expect(templatesRequest).not.toContain('teamID')
    expect(templatesRequest).not.toContain('some-team-id')
  })

  test('template list without --team prints no deprecation warning', async () => {
    const result = await runCliWithPipedStdin(
      ['template', 'list'],
      Buffer.alloc(0),
      { timeoutMs: 30_000, env: mockApiEnv() }
    )

    const output =
      bufferToText(result.stdout) + bufferToText(result.stderr)
    expect(output).not.toContain(DEPRECATION_WARNING)
    expect(result.status).toBe(0)
  })
})

describe('template commands require an API key', () => {
  const tmpDirs: string[] = []

  afterEach(() => {
    for (const tmpDir of tmpDirs.splice(0)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // Point the home directory at an empty temp dir so no ~/.e2b/config.json
  // credentials leak in, and strip all E2B auth env vars.
  function noAuthEnv(): NodeJS.ProcessEnv {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-no-auth-'))
    tmpDirs.push(tmpHome)
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tmpHome,
      USERPROFILE: tmpHome,
    }
    delete env.E2B_API_KEY
    delete env.E2B_ACCESS_TOKEN
    return env
  }

  const guardedCommands: [string, string[]][] = [
    ['publish', ['template', 'publish', 'some-template', '--yes']],
    ['unpublish', ['template', 'unpublish', 'some-template', '--yes']],
    ['delete', ['template', 'delete', 'some-template', '--yes']],
  ]

  test.each(guardedCommands)(
    'template %s without credentials shows the login hint',
    (_name: string, args: string[]) => {
      const result = runCli(args, { timeoutMs: 30_000, env: noAuthEnv() })

      const output =
        bufferToText(result.stdout as string) +
        bufferToText(result.stderr as string)
      expect(output).toContain('You must be logged in to use this command')
      expect(result.status).toBe(1)
    }
  )
})
