import type { CommandUnknownOpts } from '@commander-js/extra-typings'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const PROJECT_UUID = '4151943a-a079-4e90-a768-5329467f5c67'
const PROJECT_ID = 'prj_21a6a3n83s9t8aet2k5537yq37'

const mocks = vi.hoisted(() => {
  const paginator = <T>(items: T[]) => ({
    hasNext: true,
    async nextItems() {
      this.hasNext = false
      return items
    },
  })
  return {
    paginator,
    auth: {} as Record<string, unknown>,
    templatesGet: vi.fn(),
  }
})

vi.mock('e2b', () => ({
  Sandbox: {
    list: () =>
      mocks.paginator([
        {
          sandboxId: 'sbx',
          templateId: 'tpl',
          metadata: {},
          startedAt: new Date('2026-11-06T10:00:00Z'),
          endAt: new Date('2026-11-06T11:00:00Z'),
          state: 'running',
          cpuCount: 2,
          memoryMB: 512,
          envdVersion: '0.2.0',
        },
      ]),
    listSnapshots: () =>
      mocks.paginator([{ snapshotId: 'snap', names: ['my-snap'] }]),
  },
  ConnectionConfig: class {
    static setIntegration() {}
  },
  ApiClient: class {
    api = { GET: mocks.templatesGet }
  },
}))

vi.mock(
  '../../src/api',
  async (importOriginal: () => Promise<typeof import('../../src/api')>) => ({
    ...(await importOriginal()),
    ensureAuth: async () => mocks.auth,
  })
)

const bearer = {
  apiHeaders: { Authorization: 'Bearer token', 'X-Team-ID': PROJECT_UUID },
  domain: 'e2b-foxtrot.dev',
}

async function run(load: () => Promise<CommandUnknownOpts>, args: string[]) {
  const out: string[] = []
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    out.push(a.join(' '))
  })
  vi.spyOn(process.stdout, 'write').mockImplementation(
    (chunk: string | Uint8Array) => {
      out.push(String(chunk))
      return true
    }
  )
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`)
  }) as never)
  await (await load()).parseAsync(args, { from: 'user' })
  return out.join('\n')
}

const sandboxList = async () =>
  (await import('../../src/commands/sandbox/list')).listCommand
const snapshotList = async () =>
  (await import('../../src/commands/sandbox/snapshot')).snapshotCommand
const templateList = async () =>
  (await import('../../src/commands/template/list')).listCommand

beforeEach(() => {
  vi.resetModules()
  mocks.templatesGet.mockResolvedValue({
    response: { ok: true, headers: new Headers() },
    data: [
      {
        templateID: 'tpl',
        aliases: ['my-tpl'],
        public: false,
        cpuCount: 2,
        memoryMB: 512,
        createdAt: '2026-11-06T10:00:00Z',
        diskSizeMB: 1024,
        envdVersion: '0.2.0',
      },
    ],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('lists with the access token', () => {
  beforeEach(() => {
    mocks.auth = bearer
  })

  test('sandbox list shows the project ID', async () => {
    const pretty = await run(sandboxList, [])
    expect(pretty).toContain('PROJECT ID')
    expect(pretty).toContain(PROJECT_ID)

    const json = JSON.parse(await run(sandboxList, ['-f', 'json']))
    expect(json[0]).toMatchObject({ sandboxId: 'sbx', projectID: PROJECT_ID })
  })

  test('snapshot list shows the project ID', async () => {
    expect(await run(snapshotList, ['list'])).toContain(PROJECT_ID)

    const json = JSON.parse(await run(snapshotList, ['list', '-f', 'json']))
    expect(json[0]).toMatchObject({ snapshotId: 'snap', projectID: PROJECT_ID })
  })

  test('template list shows the project ID', async () => {
    expect(await run(templateList, [])).toContain(PROJECT_ID)

    const json = JSON.parse((await run(templateList, ['-f', 'json'])).trim())
    expect(json[0]).toMatchObject({ templateID: 'tpl', projectID: PROJECT_ID })
  })
})

describe('lists with E2B_API_KEY', () => {
  beforeEach(() => {
    mocks.auth = { apiKey: 'e2b_key' }
  })

  test('leave the project ID out, since the key decides the project', async () => {
    expect(await run(sandboxList, [])).not.toContain('PROJECT ID')
    expect(await run(snapshotList, ['list'])).not.toContain('PROJECT ID')
    expect(await run(templateList, [])).not.toContain('PROJECT ID')

    const json = JSON.parse(await run(sandboxList, ['-f', 'json']))
    expect(json[0]).not.toHaveProperty('projectID')
  })
})
