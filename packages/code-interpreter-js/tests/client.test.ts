import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, assert, beforeAll, beforeEach, test } from 'vitest'

import { E2B, Sandbox, Volume } from '../src'

const API_KEY_A = `e2b_${'a'.repeat(40)}`
const API_KEY_B = `e2b_${'b'.repeat(40)}`
const ENV_API_KEY = `e2b_${'e'.repeat(40)}`

const DOMAIN_A = 'client-a.test'
const DOMAIN_B = 'client-b.test'
const DOMAIN_ENV = 'env.test'

interface RecordedRequest {
  path: string
  apiKey?: string
  body: unknown
}

let requests: RecordedRequest[] = []
let server: Server
let apiUrl: string

const lastRequest = () => requests[requests.length - 1]
const apiKeys = () => requests.map((request) => request.apiKey)

async function handler(req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString()

  requests.push({
    path: req.url ?? '',
    apiKey: (req.headers['x-api-key'] as string | undefined) ?? undefined,
    body: raw ? JSON.parse(raw) : undefined,
  })

  const respond = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const path = req.url ?? ''
  if (path.startsWith('/sandboxes')) {
    respond(201, {
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  } else if (path.startsWith('/volumes')) {
    respond(201, {
      volumeID: 'test-volume-id',
      name: 'test-volume',
      token: 'test-volume-token',
    })
  } else if (path.startsWith('/templates/aliases/')) {
    respond(200, { aliases: [], templateID: 'test-template-id' })
  } else if (path.startsWith('/secrets')) {
    respond(201, {
      secretID: 'test-secret-id',
      name: 'test-secret',
      currentVersion: 1,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } else {
    respond(404, { code: 404, message: 'not found' })
  }
}

const envBackup: Record<string, string | undefined> = {}
const envOverrides: Record<string, string | undefined> = {
  E2B_API_KEY: ENV_API_KEY,
  E2B_DOMAIN: DOMAIN_ENV,
  E2B_API_URL: undefined,
  E2B_SANDBOX_URL: undefined,
  E2B_DEBUG: undefined,
}

beforeAll(async () => {
  for (const [key, value] of Object.entries(envOverrides)) {
    envBackup[key] = process.env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  )

  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

beforeEach(() => {
  requests = []
})

test('client.Sandbox.create uses the client config instead of env vars', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })

  const sandbox = await client.Sandbox.create()

  assert.deepEqual(apiKeys(), [API_KEY_A])
  assert.equal(sandbox.sandboxDomain, DOMAIN_A)
  // The Code Interpreter template is still the default.
  assert.equal(
    (lastRequest().body as { templateID: string }).templateID,
    'code-interpreter-v1'
  )
})

test('client.Sandbox instances keep the Code Interpreter API', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })

  assert.notEqual(client.Sandbox, Sandbox)
  assert.isTrue(client.Sandbox.prototype instanceof Sandbox)

  const sandbox = await client.Sandbox.create()

  assert.instanceOf(sandbox, Sandbox)
  assert.instanceOf(sandbox, client.Sandbox)
  assert.isFunction(sandbox.runCode)
  assert.isFunction(sandbox.createCodeContext)
})

test('per-call options take precedence over the client config', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })

  const sandbox = await client.Sandbox.create({
    apiKey: API_KEY_B,
    domain: DOMAIN_B,
  })

  assert.deepEqual(apiKeys(), [API_KEY_B])
  assert.equal(sandbox.sandboxDomain, DOMAIN_B)
})

test('per-call options explicitly set to undefined keep the client config', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })

  const sandbox = await client.Sandbox.create({
    apiKey: undefined,
    domain: undefined,
  })

  assert.deepEqual(apiKeys(), [API_KEY_A])
  assert.equal(sandbox.sandboxDomain, DOMAIN_A)
})

test('two clients with different configs stay isolated', async () => {
  const clientA = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })
  const clientB = new E2B({ apiKey: API_KEY_B, domain: DOMAIN_B, apiUrl })

  const sandboxA = await clientA.Sandbox.create()
  const sandboxB = await clientB.Sandbox.create()

  assert.deepEqual(apiKeys(), [API_KEY_A, API_KEY_B])
  assert.equal(sandboxA.sandboxDomain, DOMAIN_A)
  assert.equal(sandboxB.sandboxDomain, DOMAIN_B)
})

test('mutating the options object does not change the bound config', async () => {
  const opts = { apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl }
  const client = new E2B(opts)
  opts.apiKey = API_KEY_B

  await client.Sandbox.create()

  assert.deepEqual(apiKeys(), [API_KEY_A])
})

test('client.Sandbox can be rebound to a variable', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })
  const S = client.Sandbox

  const sandbox = await S.create()

  assert.deepEqual(apiKeys(), [API_KEY_A])
  assert.equal(sandbox.sandboxDomain, DOMAIN_A)
})

test('the core resources are bound to the client config as well', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })

  const volume = await client.Volume.create('test-volume')
  assert.instanceOf(volume, Volume)
  assert.deepEqual(apiKeys(), [API_KEY_A])

  assert.isTrue(await client.Template.exists('test-template'))
  await client.Secret.create('test-secret', 'value')

  assert.deepEqual(apiKeys(), [API_KEY_A, API_KEY_A, API_KEY_A])
})

test('the top-level Sandbox keeps using the environment configuration', async () => {
  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A, apiUrl })
  await client.Sandbox.create()

  const sandbox = await Sandbox.create({ apiUrl })

  assert.equal(lastRequest().apiKey, ENV_API_KEY)
  assert.equal(sandbox.sandboxDomain, DOMAIN_ENV)
})
