import { afterEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createApiFetch: vi.fn(() => vi.fn()),
}))

vi.mock('../../src/api/http2', () => ({
  createApiFetch: mocks.createApiFetch,
}))

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.E2B_HTTP_VERSION
})

async function createContentClient(
  httpVersion?: '1.1' | '2',
  opts?: { httpVersion?: '1.1' | '2'; proxy?: string }
) {
  const { Volume } = await import('../../src')
  const { VolumeApiClient, VolumeConnectionConfig } =
    await import('../../src/volume/client')
  const volume = new Volume(
    'vol-id',
    'vol',
    'vol-token',
    undefined,
    undefined,
    opts?.proxy,
    httpVersion
  )
  return new VolumeApiClient(new VolumeConnectionConfig(volume, opts))
}

test('volume content fetch defaults to HTTP/2', async () => {
  await createContentClient()

  expect(mocks.createApiFetch.mock.calls[0][0]).toMatchObject({
    proxy: undefined,
    httpVersion: '2',
  })
})

test('volume content fetch follows the httpVersion kept on the instance', async () => {
  await createContentClient('1.1', { proxy: 'http://127.0.0.1:8080' })

  expect(mocks.createApiFetch.mock.calls[0][0]).toMatchObject({
    proxy: 'http://127.0.0.1:8080',
    httpVersion: '1.1',
  })
})

test('a per-call httpVersion overrides the instance value', async () => {
  await createContentClient('1.1', { httpVersion: '2' })

  expect(mocks.createApiFetch.mock.calls[0][0]).toMatchObject({
    proxy: undefined,
    httpVersion: '2',
  })
})

test('E2B_HTTP_VERSION=1.1 pins volume content fetch to HTTP/1.1', async () => {
  process.env.E2B_HTTP_VERSION = '1.1'
  await createContentClient()

  expect(mocks.createApiFetch.mock.calls[0][0]).toMatchObject({
    proxy: undefined,
    httpVersion: '1.1',
  })
})
