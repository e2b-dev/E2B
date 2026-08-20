import { afterAll, afterEach, assert, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import DefaultExport, {
  E2B,
  Sandbox,
  Secret,
  Template,
  TemplateBase,
  Volume,
} from '../src'
import { TEST_API_KEY } from './setup'

const API_KEY_A = `e2b_${'a'.repeat(40)}`
const API_KEY_B = `e2b_${'b'.repeat(40)}`

const DOMAIN_A = 'client-a.test'
const DOMAIN_B = 'client-b.test'
const DOMAIN_ENV = 'env.test'

interface RecordedRequest {
  url: string
  apiKey?: string
}

const requests: RecordedRequest[] = []

function record(request: Request) {
  requests.push({
    url: request.url,
    apiKey: request.headers.get('X-API-KEY') ?? undefined,
  })
}

const lastRequest = () => requests[requests.length - 1]

const sandboxResponse = {
  sandboxID: 'test-sandbox-id',
  templateID: 'base',
  envdVersion: '0.2.4',
}

const server = setupServer(
  http.post(/\/sandboxes$/, async ({ request }) => {
    record(request)
    return HttpResponse.json(sandboxResponse)
  }),
  http.delete(/\/sandboxes\/[^/]+$/, ({ request }) => {
    record(request)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(/\/v2\/sandboxes/, ({ request }) => {
    record(request)
    return HttpResponse.json([])
  }),
  http.post(/\/volumes$/, ({ request }) => {
    record(request)
    return HttpResponse.json({
      volumeID: 'test-volume-id',
      name: 'test-volume',
      token: 'test-volume-token',
    })
  }),
  http.get(/\/volumes$/, ({ request }) => {
    record(request)
    return HttpResponse.json([])
  }),
  http.get(/\/templates\/aliases\/[^/]+$/, ({ request }) => {
    record(request)
    return HttpResponse.json({ aliases: [], templateID: 'test-template-id' })
  }),
  http.get(/\/templates\/[^/]+\/tags$/, ({ request }) => {
    record(request)
    return HttpResponse.json([])
  })
)

const envBackup: Record<string, string | undefined> = {}
const envOverrides = {
  E2B_DOMAIN: DOMAIN_ENV,
  E2B_API_KEY: TEST_API_KEY,
  E2B_API_URL: undefined,
  E2B_SANDBOX_URL: undefined,
  E2B_DEBUG: undefined,
}

beforeAll(() => {
  for (const [key, value] of Object.entries(envOverrides)) {
    envBackup[key] = process.env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  server.close()

  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

afterEach(() => {
  requests.length = 0
  server.resetHandlers()
})

test('client.Sandbox.create uses the client config instead of env vars', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })

  const sandbox = await client.Sandbox.create()

  assert.equal(lastRequest().url, `https://api.${DOMAIN_A}/sandboxes`)
  assert.equal(lastRequest().apiKey, API_KEY_A)
  // The bound config is also carried by the created sandbox instance.
  assert.equal(sandbox.sandboxDomain, DOMAIN_A)
})

test('client.Sandbox instances are subclass instances of Sandbox', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })

  assert.notEqual(client.Sandbox, Sandbox)
  assert.isTrue(client.Sandbox.prototype instanceof Sandbox)
  assert.instanceOf(await client.Sandbox.create(), Sandbox)
  // Class-level defaults are inherited from Sandbox.
  assert.equal(lastRequest().url, `https://api.${DOMAIN_A}/sandboxes`)
})

test('per-call options take precedence over the client config', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })

  await client.Sandbox.create({ apiKey: API_KEY_B, domain: DOMAIN_B })

  assert.equal(lastRequest().url, `https://api.${DOMAIN_B}/sandboxes`)
  assert.equal(lastRequest().apiKey, API_KEY_B)
})

test('client.Sandbox can be rebound to a variable', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
  const S = client.Sandbox

  await S.create()
  await S.kill('test-sandbox-id')
  await S.list().nextItems()

  for (const request of requests) {
    expect(request.url).toContain(`api.${DOMAIN_A}`)
    assert.equal(request.apiKey, API_KEY_A)
  }
})

test('two clients with different configs stay isolated', async () => {
  const clientA = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
  const clientB = new E2B({ apiKey: API_KEY_B, domain: DOMAIN_B })

  await clientA.Sandbox.create()
  await clientB.Sandbox.create()

  assert.deepEqual(
    requests.map((r) => [r.url, r.apiKey]),
    [
      [`https://api.${DOMAIN_A}/sandboxes`, API_KEY_A],
      [`https://api.${DOMAIN_B}/sandboxes`, API_KEY_B],
    ]
  )
})

test('mutating the options object does not change the bound config', async () => {
  const opts = { apiKey: API_KEY_A, domain: DOMAIN_A }
  const client = new E2B(opts)
  opts.domain = DOMAIN_B

  await client.Sandbox.create()

  assert.equal(lastRequest().url, `https://api.${DOMAIN_A}/sandboxes`)
})

test('client.Volume.create uses the client config', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })

  const volume = await client.Volume.create('test-volume')

  assert.equal(lastRequest().url, `https://api.${DOMAIN_A}/volumes`)
  assert.equal(lastRequest().apiKey, API_KEY_A)
  assert.instanceOf(volume, Volume)
  assert.instanceOf(volume, client.Volume)
  assert.equal(volume.domain, DOMAIN_A)

  await client.Volume.list()
  assert.equal(lastRequest().url, `https://api.${DOMAIN_A}/volumes`)
})

test('client.Template statics use the client config', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })

  await client.Template.exists('test-template')
  await client.Template.getTags('test-template-id')

  for (const request of requests) {
    expect(request.url).toContain(`api.${DOMAIN_A}`)
    assert.equal(request.apiKey, API_KEY_A)
  }

  // Per-call options still win.
  await client.Template.getTags('test-template-id', {
    apiKey: API_KEY_B,
    domain: DOMAIN_B,
  })
  assert.equal(
    lastRequest().url,
    `https://api.${DOMAIN_B}/templates/test-template-id/tags`
  )
  assert.equal(lastRequest().apiKey, API_KEY_B)
})

test('client.Template builds template instances', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
  const template = client.Template().fromPythonImage('3')

  assert.instanceOf(template, TemplateBase)
  assert.instanceOf(template, client.Template)
  assert.instanceOf(new client.Template(), client.Template)
  assert.equal(
    await client.Template.toDockerfile(template),
    await Template.toDockerfile(Template().fromPythonImage('3'))
  )
})

test('client.Template can be rebound to a variable', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
  const T = client.Template

  await T.exists('test-template')

  assert.equal(
    lastRequest().url,
    `https://api.${DOMAIN_A}/templates/aliases/test-template`
  )
  assert.equal(lastRequest().apiKey, API_KEY_A)
})

test('client.Secret is the top-level Secret class', () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })

  assert.equal(client.Secret, Secret)
})

test('top-level exports keep using the environment configuration', async () => {
  // Constructed (and used) first to prove clients do not leak into the
  // env-configured default path.
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
  await client.Sandbox.create()

  await Sandbox.create()
  assert.equal(lastRequest().url, `https://api.${DOMAIN_ENV}/sandboxes`)
  assert.equal(lastRequest().apiKey, TEST_API_KEY)

  await Volume.list()
  assert.equal(lastRequest().url, `https://api.${DOMAIN_ENV}/volumes`)
  assert.equal(lastRequest().apiKey, TEST_API_KEY)

  await Template.exists('test-template')
  assert.equal(
    lastRequest().url,
    `https://api.${DOMAIN_ENV}/templates/aliases/test-template`
  )
  assert.equal(lastRequest().apiKey, TEST_API_KEY)
})

test('the default export is the E2B client', async () => {
  assert.equal(DefaultExport, E2B)

  const client = new DefaultExport({ apiKey: API_KEY_A, domain: DOMAIN_A })
  await client.Sandbox.create()

  assert.equal(lastRequest().url, `https://api.${DOMAIN_A}/sandboxes`)
  assert.equal(lastRequest().apiKey, API_KEY_A)
})
