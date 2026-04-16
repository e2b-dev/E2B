import { afterEach, assert, test, vi } from 'vitest'
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

type UploadOutcome = Error | number | undefined

class FakeEnvdApi {
  version = '0.5.11'
  calls = 0
  api: { POST: (...args: unknown[]) => Promise<unknown> }

  constructor(
    private readonly counter = new UploadCounter(),
    private readonly outcomes: UploadOutcome[] = [],
    private readonly delayMs = 10
  ) {
    this.api = {
      POST: async (_path, opts) => {
        this.calls += 1
        await this.counter.track(this.delayMs)

        const outcome = this.outcomes.shift()
        if (outcome instanceof Error) {
          throw outcome
        }

        const path = (opts as any).params.query.path
        if (typeof outcome === 'number') {
          return {
            response: new Response(
              JSON.stringify({ message: 'rate limited' }),
              {
                status: outcome,
              }
            ),
            error: { message: 'rate limited' },
          }
        }

        return {
          response: new Response('{}', { status: 200 }),
          data: [{ name: path.split('/').pop(), type: 'file', path }],
        }
      },
    }
  }
}

function createFilesystem(envdApi: FakeEnvdApi) {
  const filesystem = Object.create(Filesystem.prototype) as Filesystem
  ;(filesystem as any).envdApi = envdApi
  ;(filesystem as any).connectionConfig = { getSignal: () => undefined }
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
  process.env.E2B_MAX_CONCURRENT_FILE_UPLOADS = '2'
  const counter = new UploadCounter()
  const envdApi = new FakeEnvdApi(counter)

  const infos = await createFilesystem(envdApi).writeFiles(files('file', 5))

  assert.equal((infos as unknown[]).length, 5)
  assert.equal(counter.maxActive, 2)
})

test('writeFiles applies global upload concurrency', async () => {
  process.env.E2B_MAX_CONCURRENT_FILE_UPLOADS = '5'
  process.env.E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS = '2'
  const counter = new UploadCounter()

  await Promise.all([
    createFilesystem(new FakeEnvdApi(counter)).writeFiles(files('a', 3)),
    createFilesystem(new FakeEnvdApi(counter)).writeFiles(files('b', 3)),
  ])

  assert.equal(counter.maxActive, 2)
})

test('writeFiles retries transient and rate-limit upload errors', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  process.env.E2B_MAX_CONCURRENT_FILE_UPLOADS = '1'
  process.env.E2B_FILE_UPLOAD_RETRY_ATTEMPTS = '3'
  const envdApi = new FakeEnvdApi(
    new UploadCounter(),
    [new TypeError('fetch failed'), 429, undefined],
    0
  )

  const promise = createFilesystem(envdApi).writeFiles([
    { path: '/tmp/retry.txt', data: 'retry' },
  ])
  await vi.advanceTimersByTimeAsync(1_000)
  const infos = await promise

  assert.equal((infos as unknown[]).length, 1)
  assert.equal(envdApi.calls, 3)
})
