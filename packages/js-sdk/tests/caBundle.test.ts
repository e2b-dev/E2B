import { afterAll, beforeAll, expect, test, vi } from 'vitest'

import { buildDispatchedFetch, type UndiciModule } from '../src/undici'
import { dynamicImport, runtime } from '../src/utils'

// The `caBundle` option is Node-only: no other runtime lets the SDK configure
// TLS trust per connection, and reading the bundle needs a filesystem. The
// node modules are imported the way the SDK imports them — at runtime, so
// this file stays loadable in the runtimes that skip these tests.
const nodeOnly = test.skipIf(runtime !== 'node')

const CA_PEM =
  '-----BEGIN CERTIFICATE-----\nnot-a-real-certificate\n-----END CERTIFICATE-----\n'

let fs: typeof import('node:fs')
let rootCertificates: readonly string[]
let tempDir: string
let caBundle: string

beforeAll(async () => {
  if (runtime !== 'node') {
    return
  }

  const [fsModule, os, path, tls] = await Promise.all([
    dynamicImport<typeof import('node:fs')>('node:fs'),
    dynamicImport<typeof import('node:os')>('node:os'),
    dynamicImport<typeof import('node:path')>('node:path'),
    dynamicImport<typeof import('node:tls')>('node:tls'),
  ])
  fs = fsModule
  rootCertificates = tls.rootCertificates

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-ca-'))
  caBundle = path.join(tempDir, 'ca.pem')
  fs.writeFileSync(caBundle, CA_PEM)
})

afterAll(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

type AgentOptions = { connect?: { ca: string[] } }
type ProxyAgentOptions = {
  uri?: string
  requestTls?: { ca: string[] }
  proxyTls?: { ca: string[] }
}

function fakeUndici(
  agents: AgentOptions[],
  proxyAgents: ProxyAgentOptions[] = []
) {
  class Agent {
    constructor(options: AgentOptions) {
      agents.push(options)
    }
  }

  class ProxyAgent {
    constructor(options: ProxyAgentOptions) {
      proxyAgents.push(options)
    }
  }

  return {
    Agent,
    ProxyAgent,
    fetch: vi.fn(() => Promise.resolve(new Response('ok'))),
  } as unknown as UndiciModule
}

nodeOnly('trusts the CA bundle on top of the default roots', async () => {
  const agents: AgentOptions[] = []

  const fetcher = await buildDispatchedFetch({
    connections: 1,
    inflightLimit: 0,
    caBundle,
    loadUndici: async () => fakeUndici(agents),
  })
  await fetcher('https://api.example.test/sandboxes')

  expect(agents).toHaveLength(1)
  // The public roots stay trusted: the bundle adds a private CA rather than
  // replacing the store, so connections to public hosts keep working.
  expect(agents[0].connect?.ca).toEqual([...rootCertificates, CA_PEM])
})

nodeOnly('leaves the default trust alone without a CA bundle', async () => {
  const agents: AgentOptions[] = []

  const fetcher = await buildDispatchedFetch({
    connections: 1,
    inflightLimit: 0,
    loadUndici: async () => fakeUndici(agents),
  })
  await fetcher('https://api.example.test/sandboxes')

  expect(agents[0].connect).toBeUndefined()
})

nodeOnly('trusts the CA bundle through a proxy tunnel', async () => {
  const proxyAgents: ProxyAgentOptions[] = []

  const fetcher = await buildDispatchedFetch({
    connections: 1,
    inflightLimit: 0,
    proxy: 'http://127.0.0.1:8080',
    caBundle,
    loadUndici: async () => fakeUndici([], proxyAgents),
  })
  await fetcher('https://api.example.test/sandboxes')

  expect(proxyAgents).toHaveLength(1)
  // A ProxyAgent builds its own `connect`, so the trust has to be configured
  // for the tunneled request to the origin — and for the proxy itself, in
  // case it is reached over HTTPS.
  const trusted = [...rootCertificates, CA_PEM]
  expect(proxyAgents[0].requestTls?.ca).toEqual(trusted)
  expect(proxyAgents[0].proxyTls?.ca).toEqual(trusted)
})

nodeOnly('reports a CA bundle that cannot be read', async () => {
  await expect(
    buildDispatchedFetch({
      connections: 1,
      inflightLimit: 0,
      caBundle: `${caBundle}.missing`,
      loadUndici: async () => fakeUndici([]),
    })
  ).rejects.toThrow(/Could not read the CA bundle/)
})

nodeOnly('reports a CA bundle holding no certificate', async () => {
  const notPem = `${caBundle}.der`
  fs.writeFileSync(notPem, Buffer.from([0x30, 0x82, 0x01]))

  await expect(
    buildDispatchedFetch({
      connections: 1,
      inflightLimit: 0,
      caBundle: notPem,
      loadUndici: async () => fakeUndici([]),
    })
  ).rejects.toThrow(/holds no PEM certificate/)
})

nodeOnly('reports a CA bundle undici cannot apply', async () => {
  // Without undici there is no dispatcher to hang the trust on, and the
  // global fetch would silently connect with the default trust instead.
  await expect(
    buildDispatchedFetch({
      connections: 1,
      inflightLimit: 0,
      caBundle,
      loadUndici: async () => undefined,
    })
  ).rejects.toThrow(/needs the `undici` package/)
})

test('rejects a CA bundle in a runtime that cannot apply it', async () => {
  const { createApiFetchForRuntime } = await import('../src/api/http2')

  expect(() =>
    createApiFetchForRuntime('workerd', { caBundle: '/etc/ssl/ca.pem' })
  ).toThrow(/only supported on Node/)
  // Without the option those runtimes keep using their global fetch.
  expect(() => createApiFetchForRuntime('workerd')).not.toThrow()
})
