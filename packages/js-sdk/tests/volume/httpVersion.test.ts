import { afterEach, expect, test, vi } from 'vitest'

import { Volume } from '../../src'

// Volume content requests go out through undici on Node. Stand in for the
// library at that boundary to observe which dispatcher (HTTP version, proxy)
// each request is sent with and where it goes.
const undici = vi.hoisted(() => {
  class Agent {
    constructor(readonly options: Record<string, unknown>) {}
  }
  class ProxyAgent {
    constructor(readonly options: Record<string, unknown>) {}
  }
  const requests: Array<{ url: string; dispatcher: unknown }> = []
  const fetch = async (
    input: string | URL,
    init: RequestInit & { dispatcher?: unknown }
  ) => {
    requests.push({ url: String(input), dispatcher: init.dispatcher })
    return new Response(null, { status: 204 })
  }
  return { requests, module: { Agent, ProxyAgent, fetch } }
})

vi.mock('undici', () => undici.module)
// tests/globalFetchFallback.setup.ts makes undici unavailable for every suite;
// restore the real loader so this suite exercises the undici path.
vi.mock('../../src/undici', async (importOriginal) => importOriginal())

afterEach(() => {
  undici.requests.length = 0
  delete process.env.E2B_HTTP_VERSION
})

function volume(opts?: { httpVersion?: '1.1' | '2'; proxy?: string }) {
  return new Volume(
    'vol-id',
    'vol',
    'vol-token',
    'example.test',
    undefined,
    opts?.proxy,
    { httpVersion: opts?.httpVersion }
  )
}

function sentRequest() {
  expect(undici.requests).toHaveLength(1)
  return undici.requests[0]
}

test('volume content requests default to HTTP/2', async () => {
  await volume().remove('/file')

  const { url, dispatcher } = sentRequest()
  expect(url).toBe(
    'https://api.example.test/volumecontent/vol-id/path?path=%2Ffile'
  )
  expect(dispatcher).toBeInstanceOf(undici.module.Agent)
  expect(dispatcher).toMatchObject({ options: { allowH2: true } })
})

test('volume content requests follow the httpVersion and proxy kept on the instance', async () => {
  await volume({
    httpVersion: '1.1',
    proxy: 'http://127.0.0.1:8080',
  }).remove('/file')

  const { dispatcher } = sentRequest()
  expect(dispatcher).toBeInstanceOf(undici.module.ProxyAgent)
  expect(dispatcher).toMatchObject({
    options: { uri: 'http://127.0.0.1:8080', allowH2: false },
  })
})

test('a per-call httpVersion overrides the instance value', async () => {
  await volume({ httpVersion: '1.1' }).remove('/file', { httpVersion: '2' })

  expect(sentRequest().dispatcher).toMatchObject({
    options: { allowH2: true },
  })
})

test('E2B_HTTP_VERSION=1.1 pins volume content requests to HTTP/1.1', async () => {
  process.env.E2B_HTTP_VERSION = '1.1'

  await volume().remove('/file')

  expect(sentRequest().dispatcher).toMatchObject({
    options: { allowH2: false },
  })
})
