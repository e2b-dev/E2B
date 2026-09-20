import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import {
  InvalidArgumentError,
  NotFoundError,
  Sandbox,
  SandboxError,
} from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

const sandboxId = 'test-sandbox-id'

const valkeyInfo = {
  entry: 'valkey',
  version: '7.4.1',
  role: 'service',
  class: 'stateful',
  state: 'running',
  name: 'valkey.sidecar.e2b.local',
  address: '169.254.0.25',
  ports: [6379],
}

const failedProxyInfo = {
  entry: 'iron-proxy',
  version: '0.4.1',
  role: 'proxy',
  class: 'stateful',
  state: 'failed',
  name: 'iron-proxy.sidecar.e2b.local',
  lastError: 'readiness probe timed out',
}

const sandboxDetail = {
  sandboxID: sandboxId,
  templateID: 'base',
  clientID: 'test-client',
  envdVersion: '0.2.4',
  startedAt: '2026-01-01T00:00:00Z',
  endAt: '2026-01-01T01:00:00Z',
  state: 'running',
  cpuCount: 2,
  memoryMB: 512,
  diskSizeMB: 1024,
}

const projectDbVersion = {
  name: 'project-db',
  entry: 'sqlite',
  version: 2,
  entryVersion: '0.24.32',
  sizeBytes: 4194304,
  sourceSandboxID: sandboxId,
  createdAt: '2026-09-20T10:00:00Z',
}

const projectDbState = {
  name: 'project-db',
  entry: 'sqlite',
  sizeMiB: 512,
  latestVersion: 2,
  versionCount: 2,
  createdAt: '2026-09-19T09:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
}

let lastCreateBody: Record<string, any> | undefined
let createResponse: () => HttpResponse
let connectResponse: () => HttpResponse = () =>
  HttpResponse.json({ sandboxID: sandboxId, envdVersion: '0.2.4' })
let infoSidecars: unknown[] | undefined
let lastSaveStateRequest: { entry: string; body: any } | undefined
let saveStateResponse: () => HttpResponse = () =>
  HttpResponse.json(projectDbVersion, { status: 201 })
let listStatesResponse: () => HttpResponse = () =>
  HttpResponse.json([projectDbState])
let getStateResponse: () => HttpResponse = () =>
  HttpResponse.json({ ...projectDbState, versions: [projectDbVersion] })
let deleteStateResponse: () => HttpResponse = () =>
  new HttpResponse(null, { status: 204 })
let lastDeletePath: string | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, any>
    return createResponse()
  }),
  http.get(apiUrl(`/sandboxes/${sandboxId}`), () =>
    HttpResponse.json({ ...sandboxDetail, sidecars: infoSidecars })
  ),
  http.get(apiUrl('/v2/sandboxes'), () =>
    HttpResponse.json([{ ...sandboxDetail, sidecars: infoSidecars }])
  ),
  http.post(apiUrl(`/sandboxes/${sandboxId}/connect`), () => connectResponse()),
  http.put(apiUrl(`/sandboxes/${sandboxId}/network`), () =>
    HttpResponse.json(
      {
        code: 400,
        error_code: 'sidecar_rule_collision',
        message: 'api.openai.com is routed through the iron-proxy sidecar',
      },
      { status: 400 }
    )
  ),
  http.post(
    apiUrl(`/sandboxes/${sandboxId}/sidecars/:entry/state`),
    async ({ request, params }) => {
      lastSaveStateRequest = {
        entry: params.entry as string,
        body: await request.json(),
      }
      return saveStateResponse()
    }
  ),
  http.get(apiUrl('/sidecar-states'), () => listStatesResponse()),
  http.get(apiUrl('/sidecar-states/:name'), () => getStateResponse()),
  http.delete(apiUrl('/sidecar-states/:name'), ({ request }) => {
    lastDeletePath = new URL(request.url).pathname
    return deleteStateResponse()
  }),
  http.delete(
    apiUrl('/sidecar-states/:name/versions/:version'),
    ({ request }) => {
      lastDeletePath = new URL(request.url).pathname
      return deleteStateResponse()
    }
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  infoSidecars = undefined
  connectResponse = () =>
    HttpResponse.json({ sandboxID: sandboxId, envdVersion: '0.2.4' })
  lastSaveStateRequest = undefined
  lastDeletePath = undefined
  saveStateResponse = () => HttpResponse.json(projectDbVersion, { status: 201 })
  listStatesResponse = () => HttpResponse.json([projectDbState])
  getStateResponse = () =>
    HttpResponse.json({ ...projectDbState, versions: [projectDbVersion] })
  deleteStateResponse = () => new HttpResponse(null, { status: 204 })
  createResponse = () =>
    HttpResponse.json({
      sandboxID: sandboxId,
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  server.resetHandlers()
})

createResponse = () =>
  HttpResponse.json({
    sandboxID: sandboxId,
    templateID: 'base',
    envdVersion: '0.2.4',
  })

test('Sandbox.create sends the sidecars in the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [
      { entry: 'valkey' },
      {
        entry: 'iron-proxy',
        version: '0.4.1',
        config: { allow: ['api.openai.com'] },
        secrets: { upstream: '${e2b.secrets.openai-key}' },
      },
    ],
  })

  expect(lastCreateBody?.sidecars).toEqual([
    { entry: 'valkey' },
    {
      entry: 'iron-proxy',
      version: '0.4.1',
      config: { allow: ['api.openai.com'] },
      secrets: { upstream: '${e2b.secrets.openai-key}' },
    },
  ])
})

test.each([
  ['not provided', {}],
  ['an empty list', { sidecars: [] }],
  ['null', { sidecars: null as any }],
])('Sandbox.create omits sidecars when %s', async (_, opts) => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY, ...opts })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('sidecars')
})

test('Sandbox.create strips unknown sidecar properties', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [
      // An untyped caller can copy an extra key out of a config file; the
      // API rejects unknown properties.
      { entry: 'valkey', image: 'valkey:7' } as any,
    ],
  })

  expect(lastCreateBody?.sidecars).toEqual([{ entry: 'valkey' }])
})

test('Sandbox.create rejects a sidecar without an entry before any request', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      sidecars: [{ version: '7.4.1' } as any],
    })
  ).rejects.toThrowError(InvalidArgumentError)

  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      sidecars: { entry: 'valkey' } as any,
    })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastCreateBody).toBeUndefined()
})

test('Sandbox.getInfo returns the sidecars with their state', async () => {
  infoSidecars = [valkeyInfo, failedProxyInfo]

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars).toEqual([valkeyInfo, failedProxyInfo])
})

test('Sandbox.getInfo passes through a state value the SDK does not know', async () => {
  infoSidecars = [{ ...valkeyInfo, state: 'restarting' }]

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars?.[0].state).toBe('restarting')
})

test('Sandbox.getInfo returns an empty sidecar list when the API sends none', async () => {
  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars).toEqual([])
})

test('Sandbox.list returns the sidecars of each sandbox', async () => {
  infoSidecars = [valkeyInfo]

  const [info] = await Sandbox.list({ apiKey: TEST_API_KEY }).nextItems()

  expect(info.sidecars).toEqual([valkeyInfo])
})

test('a sidecar_* 400 surfaces as InvalidArgumentError with the code preserved', async () => {
  createResponse = () =>
    HttpResponse.json(
      {
        code: 400,
        error_code: 'sidecar_unknown_entry',
        message: 'unknown sidecar entry "memcached"',
      },
      { status: 400 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'memcached' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as SandboxError).statusCode).toBe(400)
  expect((err as Error).message).toContain('sidecar_unknown_entry')
  expect((err as Error).message).toContain('memcached')
})

test('sidecar_failed keeps the entry name and is not an argument error', async () => {
  createResponse = () =>
    HttpResponse.json(
      {
        code: 500,
        error_code: 'sidecar_failed',
        message: 'sidecar "valkey" failed to become ready',
      },
      { status: 500 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'valkey' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(SandboxError)
  expect(err).not.toBeInstanceOf(InvalidArgumentError)
  expect((err as SandboxError).statusCode).toBe(500)
  expect((err as Error).message).toContain('sidecar_failed')
  expect((err as Error).message).toContain('valkey')
})

test.each([
  'sidecar_unknown_entry',
  'sidecar_deprecated_entry',
  'sidecar_limit',
  'sidecar_one_proxy',
  'sidecar_config_invalid',
  'sidecar_secret_missing',
  'sidecar_rule_collision',
  'sidecar_egress_conflict',
  'sidecar_flag_off',
])('every 400 sidecar code (%s) is an InvalidArgumentError', async (code) => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, error_code: code, message: 'rejected' },
      {
        status: 400,
      }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'valkey' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe(`${code}: rejected`)
})

test('the sidecar code match is case-sensitive', async () => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, error_code: 'SIDECAR_UNKNOWN_ENTRY', message: 'nope' },
      { status: 400 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'memcached' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(SandboxError)
  expect(err).not.toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe('400: nope')
})

test('a 400 without a sidecar code keeps the generic mapping', async () => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, message: 'invalid template' },
      { status: 400 }
    )

  const err = await Sandbox.create('base', { apiKey: TEST_API_KEY }).catch(
    (e: unknown) => e
  )

  expect(err).toBeInstanceOf(SandboxError)
  expect(err).not.toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe('400: invalid template')
})

test.each([
  [
    'sidecar_version_unavailable',
    409,
    'catalog version valkey@7.4.0 is no longer available; sandbox stays paused',
  ],
  ['sidecar_snapshot_mismatch', 500, 'snapshot for iroh has no declaration'],
])(
  'Sandbox.connect surfaces %s as a SandboxError with the code and status',
  async (code, status, message) => {
    connectResponse = () =>
      HttpResponse.json({ code: status, error_code: code, message }, { status })

    const err = await Sandbox.connect(sandboxId, {
      apiKey: TEST_API_KEY,
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(SandboxError)
    expect(err).not.toBeInstanceOf(InvalidArgumentError)
    expect((err as SandboxError).statusCode).toBe(status)
    expect((err as Error).message).toBe(`${code}: ${message}`)
  }
)

test('Sandbox.updateNetwork surfaces sidecar_rule_collision as InvalidArgumentError', async () => {
  const err = await Sandbox.updateNetwork(
    sandboxId,
    { allowOut: ['api.openai.com'] },
    { apiKey: TEST_API_KEY }
  ).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toContain('sidecar_rule_collision')
})

test('Sandbox.create sends state and stateVersion on the attachment', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [
      { entry: 'sqlite', state: 'project-db' },
      { entry: 'valkey', state: 'warm-cache', stateVersion: 3 },
    ],
  })

  expect(lastCreateBody?.sidecars).toEqual([
    { entry: 'sqlite', state: 'project-db' },
    { entry: 'valkey', state: 'warm-cache', stateVersion: 3 },
  ])
})

test('Sandbox.getInfo reports the state a sidecar was attached from', async () => {
  infoSidecars = [{ ...valkeyInfo, stateName: 'warm-cache', stateVersion: 3 }]

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars?.[0].stateName).toBe('warm-cache')
  expect(info.sidecars?.[0].stateVersion).toBe(3)
})

test('Sandbox.getInfo omits the state fields when the sidecar has none', async () => {
  infoSidecars = [valkeyInfo]

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars?.[0]).not.toHaveProperty('stateName')
  expect(info.sidecars?.[0]).not.toHaveProperty('stateVersion')
})

test('Sandbox.saveSidecarState posts the name to the entry and parses the version', async () => {
  const version = await Sandbox.saveSidecarState(
    sandboxId,
    'sqlite',
    'project-db',
    { apiKey: TEST_API_KEY }
  )

  expect(lastSaveStateRequest).toEqual({
    entry: 'sqlite',
    body: { name: 'project-db' },
  })
  expect(version).toEqual({
    name: 'project-db',
    entry: 'sqlite',
    version: 2,
    entryVersion: '0.24.32',
    sizeBytes: 4194304,
    sourceSandboxId: sandboxId,
    createdAt: new Date('2026-09-20T10:00:00Z'),
  })
})

test('sandbox.saveSidecarState saves the state of the connected sandbox', async () => {
  const sandbox = await Sandbox.connect(sandboxId, { apiKey: TEST_API_KEY })

  const version = await sandbox.saveSidecarState('sqlite', 'project-db')

  expect(lastSaveStateRequest?.entry).toBe('sqlite')
  expect(version.version).toBe(2)
})

test('Sandbox.listSidecarStates returns the team states with Date fields', async () => {
  const states = await Sandbox.listSidecarStates({ apiKey: TEST_API_KEY })

  expect(states).toEqual([
    {
      name: 'project-db',
      entry: 'sqlite',
      sizeMiB: 512,
      latestVersion: 2,
      versionCount: 2,
      createdAt: new Date('2026-09-19T09:00:00Z'),
      updatedAt: new Date('2026-09-20T10:00:00Z'),
    },
  ])
})

test('Sandbox.getSidecarState returns the state with its versions', async () => {
  const state = await Sandbox.getSidecarState('project-db', {
    apiKey: TEST_API_KEY,
  })

  expect(state.name).toBe('project-db')
  expect(state.versions).toHaveLength(1)
  expect(state.versions[0].createdAt).toEqual(new Date('2026-09-20T10:00:00Z'))
  expect(state.versions[0].sourceSandboxId).toBe(sandboxId)
})

test('Sandbox.deleteSidecarState deletes the name, or one version of it', async () => {
  await Sandbox.deleteSidecarState('project-db', { apiKey: TEST_API_KEY })
  expect(lastDeletePath).toBe('/sidecar-states/project-db')

  await Sandbox.deleteSidecarState('project-db', {
    version: 1,
    apiKey: TEST_API_KEY,
  })
  expect(lastDeletePath).toBe('/sidecar-states/project-db/versions/1')
})

test('a state name with a path separator never reaches the wire as one', async () => {
  await Sandbox.deleteSidecarState('a/../b', { apiKey: TEST_API_KEY })

  expect(lastDeletePath).toBe('/sidecar-states/a%2F..%2Fb')
})

test.each([
  ['sidecar_state_flag_off'],
  ['sidecar_state_name_invalid'],
  ['sidecar_state_unknown'],
  ['sidecar_state_version_unknown'],
  ['sidecar_state_entry_mismatch'],
  ['sidecar_state_size_mismatch'],
  ['sidecar_state_unsupported'],
  ['sidecar_state_limit'],
])('a 400 %s on create is an InvalidArgumentError', async (code) => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, error_code: code, message: 'rejected' },
      { status: 400 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'sqlite', state: 'project-db' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe(`${code}: rejected`)
})

test.each([
  ['sidecar_not_running', 409],
  ['sidecar_state_busy', 409],
  ['sidecar_state_failed', 500],
])(
  'saveSidecarState surfaces %s as a SandboxError with the status',
  async (code, status) => {
    saveStateResponse = () =>
      HttpResponse.json(
        { code: status, error_code: code, message: 'refused' },
        { status }
      )

    const err = await Sandbox.saveSidecarState(
      sandboxId,
      'sqlite',
      'project-db',
      { apiKey: TEST_API_KEY }
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(SandboxError)
    expect(err).not.toBeInstanceOf(InvalidArgumentError)
    expect(err).not.toBeInstanceOf(NotFoundError)
    expect((err as SandboxError).statusCode).toBe(status)
    expect((err as Error).message).toBe(`${code}: refused`)
  }
)

test('saveSidecarState maps a 400 sidecar_state_name_invalid to InvalidArgumentError', async () => {
  saveStateResponse = () =>
    HttpResponse.json(
      {
        code: 400,
        error_code: 'sidecar_state_name_invalid',
        message: 'name must match ^[a-zA-Z0-9_-]+$',
      },
      { status: 400 }
    )

  const err = await Sandbox.saveSidecarState(
    sandboxId,
    'sqlite',
    'project db',
    { apiKey: TEST_API_KEY }
  ).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toContain('sidecar_state_name_invalid')
})

test.each([
  [
    'getSidecarState',
    () => Sandbox.getSidecarState('nope', { apiKey: TEST_API_KEY }),
  ],
  [
    'deleteSidecarState',
    () => Sandbox.deleteSidecarState('nope', { apiKey: TEST_API_KEY }),
  ],
])('%s raises NotFoundError for an unknown name', async (_, call) => {
  const unknown = () =>
    HttpResponse.json(
      {
        code: 404,
        error_code: 'sidecar_state_unknown',
        message: 'sidecar state "nope" not found',
      },
      { status: 404 }
    )
  getStateResponse = unknown
  deleteStateResponse = unknown

  const err = await call().catch((e: unknown) => e)

  expect(err).toBeInstanceOf(NotFoundError)
  expect((err as SandboxError).statusCode).toBe(404)
  expect((err as Error).message).toContain('sidecar_state_unknown')
})

test('deleteSidecarState raises NotFoundError for an unknown version', async () => {
  deleteStateResponse = () =>
    HttpResponse.json(
      {
        code: 404,
        error_code: 'sidecar_state_version_unknown',
        message: 'version 9 of "project-db" not found',
      },
      { status: 404 }
    )

  const err = await Sandbox.deleteSidecarState('project-db', {
    version: 9,
    apiKey: TEST_API_KEY,
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(NotFoundError)
  expect((err as Error).message).toContain('sidecar_state_version_unknown')
})

test('listSidecarStates surfaces sidecar_state_flag_off as InvalidArgumentError', async () => {
  listStatesResponse = () =>
    HttpResponse.json(
      {
        code: 400,
        error_code: 'sidecar_state_flag_off',
        message: 'the team does not have sandbox-sidecar-states',
      },
      { status: 400 }
    )

  const err = await Sandbox.listSidecarStates({
    apiKey: TEST_API_KEY,
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toContain('sidecar_state_flag_off')
})

test('saveSidecarState rejects an empty entry or name before any request', async () => {
  await expect(
    Sandbox.saveSidecarState(sandboxId, '', 'project-db', {
      apiKey: TEST_API_KEY,
    })
  ).rejects.toThrowError(InvalidArgumentError)

  await expect(
    Sandbox.saveSidecarState(sandboxId, 'sqlite', '', { apiKey: TEST_API_KEY })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastSaveStateRequest).toBeUndefined()
})
