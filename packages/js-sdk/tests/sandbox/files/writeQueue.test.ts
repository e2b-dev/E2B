import { afterEach, assert, expect, test, vi } from 'vitest'
import {
  ConnectionConfig,
  ConnectionOpts,
  FILE_UPLOAD_RETRY_ATTEMPTS,
  MAX_CONCURRENT_FILE_UPLOADS,
  MAX_GLOBAL_CONCURRENT_FILE_UPLOADS,
} from '../../../src/connectionConfig'
import { Filesystem, WriteEntry } from '../../../src/sandbox/filesystem'

const ENV_KEYS = [
  'E2B_MAX_CONCURRENT_FILE_UPLOADS',
  'E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS',
  'E2B_FILE_UPLOAD_RETRY_ATTEMPTS',
]

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
)

class UploadCounter {
  active = 0
  maxActive = 0

  async track(delayMs = 10) {
    this.active += 1
    this.maxActive = Math.max(this.maxActive, this.active)
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    this.active -= 1
  }
}

type UploadOutcome = Error | undefined

function fetchFailed(code: string): TypeError {
  return new TypeError('fetch failed', { cause: { code } })
}

class FakeEnvdApi {
  version = '0.5.11'
  calls = 0
  bodies: Uint8Array[] = []
  api: { POST: (...args: unknown[]) => Promise<unknown> }

  constructor(
    private readonly counter = new UploadCounter(),
    private readonly outcomes: UploadOutcome[] = [],
    private readonly delayMs = 10
  ) {
    this.api = {
      POST: async (_path, opts) => {
        this.calls += 1
        const body = await (opts as any).bodySerializer()
        this.bodies.push(await bodyToBytes(body))
        await this.counter.track(this.delayMs)

        const outcome = this.outcomes.shift()
        if (outcome instanceof Error) {
          throw outcome
        }

        const path = (opts as any).params.query.path
        return {
          response: new Response('{}', { status: 200 }),
          data: [{ name: path.split('/').pop(), type: 'file', path }],
        }
      },
    }
  }
}

async function bodyToBytes(body: BodyInit): Promise<Uint8Array> {
  if (body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer())
  }
  if (typeof body === 'string') {
    return new TextEncoder().encode(body)
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }
  if (body instanceof ReadableStream) {
    return new Uint8Array(await new Response(body).arrayBuffer())
  }
  throw new Error(`Unsupported test body type: ${typeof body}`)
}

function createFilesystem(envdApi: FakeEnvdApi, opts?: ConnectionOpts) {
  const filesystem = Object.create(Filesystem.prototype) as Filesystem
  ;(filesystem as any).envdApi = envdApi
  ;(filesystem as any).connectionConfig = new ConnectionConfig(opts)
  return filesystem
}

function files(prefix: string, count: number): WriteEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    path: `/tmp/${prefix}-${index}.txt`,
    data: `${prefix} ${index}`,
  }))
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value == undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('writeFiles limits octet-stream upload concurrency', async () => {
  const counter = new UploadCounter()
  const envdApi = new FakeEnvdApi(counter)

  const infos = await createFilesystem(envdApi, {
    maxConcurrentFileUploads: 2,
  }).writeFiles(files('file', 5))

  assert.equal((infos as unknown[]).length, 5)
  assert.equal(counter.maxActive, 2)
})

test('writeFiles applies global upload concurrency', async () => {
  const counter = new UploadCounter()
  const opts = {
    maxConcurrentFileUploads: 5,
    maxGlobalConcurrentFileUploads: 2,
  }

  await Promise.all([
    createFilesystem(new FakeEnvdApi(counter), opts).writeFiles(files('a', 3)),
    createFilesystem(new FakeEnvdApi(counter), opts).writeFiles(files('b', 3)),
  ])

  assert.equal(counter.maxActive, 2)
})

test('ConnectionConfig treats empty upload env vars as unset', () => {
  process.env.E2B_MAX_CONCURRENT_FILE_UPLOADS = ''
  process.env.E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS = ''
  process.env.E2B_FILE_UPLOAD_RETRY_ATTEMPTS = ''

  const config = new ConnectionConfig()

  assert.equal(config.maxConcurrentFileUploads, MAX_CONCURRENT_FILE_UPLOADS)
  assert.equal(
    config.maxGlobalConcurrentFileUploads,
    MAX_GLOBAL_CONCURRENT_FILE_UPLOADS
  )
  assert.equal(config.fileUploadRetryAttempts, FILE_UPLOAD_RETRY_ATTEMPTS)
})

test('ConnectionConfig upload options override env vars', () => {
  process.env.E2B_MAX_CONCURRENT_FILE_UPLOADS = '0'
  process.env.E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS = '0'
  process.env.E2B_FILE_UPLOAD_RETRY_ATTEMPTS = '0'

  const config = new ConnectionConfig({
    maxConcurrentFileUploads: 2,
    maxGlobalConcurrentFileUploads: 3,
    fileUploadRetryAttempts: 4,
  })

  assert.equal(config.maxConcurrentFileUploads, 2)
  assert.equal(config.maxGlobalConcurrentFileUploads, 3)
  assert.equal(config.fileUploadRetryAttempts, 4)
})

test('writeFiles retries fetch-failed errors with a known network cause', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const envdApi = new FakeEnvdApi(
    new UploadCounter(),
    [fetchFailed('ECONNRESET'), fetchFailed('EMFILE'), undefined],
    0
  )

  const promise = createFilesystem(envdApi, {
    maxConcurrentFileUploads: 1,
    fileUploadRetryAttempts: 3,
  }).writeFiles([{ path: '/tmp/retry.txt', data: 'retry' }])
  await vi.advanceTimersByTimeAsync(1_000)
  const infos = await promise

  assert.equal((infos as unknown[]).length, 1)
  assert.equal(envdApi.calls, 3)
})

test('writeFiles retries gzip upload bodies without consuming the retry body', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const envdApi = new FakeEnvdApi(
    new UploadCounter(),
    [fetchFailed('ECONNRESET'), undefined],
    0
  )

  const infos = await createFilesystem(envdApi, {
    maxConcurrentFileUploads: 1,
    fileUploadRetryAttempts: 2,
  }).writeFiles(
    [{ path: '/tmp/retry-gzip.txt', data: new Blob(['retry gzip']) }],
    {
      gzip: true,
    }
  )

  assert.equal((infos as unknown[]).length, 1)
  assert.equal(envdApi.calls, 2)
  assert.isAbove(envdApi.bodies[0]!.byteLength, 0)
  assert.deepEqual(
    Array.from(envdApi.bodies[0]!),
    Array.from(envdApi.bodies[1]!)
  )
})

test('writeFiles does not retry fetch-failed without a known network cause', async () => {
  const envdApi = new FakeEnvdApi(
    new UploadCounter(),
    [new TypeError('fetch failed')],
    0
  )

  await expect(
    createFilesystem(envdApi, {
      maxConcurrentFileUploads: 1,
      fileUploadRetryAttempts: 3,
    }).writeFiles([{ path: '/tmp/noretry.txt', data: 'noretry' }])
  ).rejects.toThrow(/fetch failed/)
  assert.equal(envdApi.calls, 1)
})

test('writeFiles stops issuing uploads after a non-retryable error', async () => {
  // First upload fails non-retryably; remaining files should not be posted.
  const envdApi = new FakeEnvdApi(new UploadCounter(), [new Error('nope')], 0)

  await expect(
    createFilesystem(envdApi, {
      maxConcurrentFileUploads: 2,
      fileUploadRetryAttempts: 1,
    }).writeFiles(files('abort', 10))
  ).rejects.toThrow(/nope/)
  assert.isBelow(envdApi.calls, 10)
})
