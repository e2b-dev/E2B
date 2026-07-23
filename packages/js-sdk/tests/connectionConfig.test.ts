import { assert, test, beforeEach, afterEach } from 'vitest'
import {
  ConnectionConfig,
  setupRequestController,
  wrapStreamWithConnectionCleanup,
} from '../src/connectionConfig'

// Store original env vars to restore after tests
let originalEnv: { [key: string]: string | undefined }

beforeEach(() => {
  originalEnv = {
    E2B_API_URL: process.env.E2B_API_URL,
    E2B_DOMAIN: process.env.E2B_DOMAIN,
    E2B_SANDBOX_URL: process.env.E2B_SANDBOX_URL,
    E2B_DEBUG: process.env.E2B_DEBUG,
    E2B_VALIDATE_API_KEY: process.env.E2B_VALIDATE_API_KEY,
  }
})

afterEach(() => {
  // Restore original env vars
  Object.keys(originalEnv).forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  })

  // Clear the process-wide integration attribution
  ConnectionConfig.setIntegration(undefined)
})

test('api_url defaults correctly', () => {
  // Ensure no env vars interfere
  delete process.env.E2B_API_URL
  delete process.env.E2B_DOMAIN
  delete process.env.E2B_DEBUG

  const config = new ConnectionConfig()
  assert.equal(config.apiUrl, 'https://api.e2b.app')
})

test('api_url in args', () => {
  const config = new ConnectionConfig({ apiUrl: 'http://localhost:8080' })
  assert.equal(config.apiUrl, 'http://localhost:8080')
})

test('api_url in env var', () => {
  process.env.E2B_API_URL = 'http://localhost:8080'

  const config = new ConnectionConfig()
  assert.equal(config.apiUrl, 'http://localhost:8080')
})

test('api_url has correct priority', () => {
  process.env.E2B_API_URL = 'http://localhost:1111'

  const config = new ConnectionConfig({ apiUrl: 'http://localhost:8080' })
  assert.equal(config.apiUrl, 'http://localhost:8080')
})

test('sandbox_url defaults to stable sandbox host in production', () => {
  delete process.env.E2B_SANDBOX_URL
  delete process.env.E2B_DOMAIN
  delete process.env.E2B_DEBUG

  const config = new ConnectionConfig()

  assert.equal(
    config.getSandboxUrl('sbx-test', {
      sandboxDomain: 'e2b.app',
      envdPort: 49983,
    }),
    'https://sandbox.e2b.app'
  )
})

test('sandbox_direct_url keeps per-sandbox host in production', () => {
  delete process.env.E2B_SANDBOX_URL
  delete process.env.E2B_DOMAIN
  delete process.env.E2B_DEBUG

  const config = new ConnectionConfig()

  assert.equal(
    config.getSandboxDirectUrl('sbx-test', {
      sandboxDomain: 'e2b.app',
      envdPort: 49983,
    }),
    'https://49983-sbx-test.e2b.app'
  )
})

test('sandbox_url keeps per-sandbox host outside production', () => {
  delete process.env.E2B_SANDBOX_URL
  delete process.env.E2B_DEBUG

  const config = new ConnectionConfig({ domain: 'e2b.dev' })

  assert.equal(
    config.getSandboxUrl('sbx-test', {
      sandboxDomain: 'sandbox.e2b.dev',
      envdPort: 49983,
    }),
    'https://49983-sbx-test.sandbox.e2b.dev'
  )
})

test('sandbox_url in args has priority', () => {
  process.env.E2B_SANDBOX_URL = 'https://sandbox.from-env'

  const config = new ConnectionConfig({ sandboxUrl: 'https://sandbox.custom' })

  assert.equal(
    config.getSandboxUrl('sbx-test', {
      sandboxDomain: 'e2b.app',
      envdPort: 49983,
    }),
    'https://sandbox.custom'
  )
})

test('sandbox_url in env var overrides default', () => {
  process.env.E2B_SANDBOX_URL = 'https://sandbox.from-env'

  const config = new ConnectionConfig()

  assert.equal(
    config.getSandboxUrl('sbx-test', {
      sandboxDomain: 'e2b.app',
      envdPort: 49983,
    }),
    'https://sandbox.from-env'
  )
})

test('sandbox_url stays localhost in debug mode', () => {
  delete process.env.E2B_SANDBOX_URL
  process.env.E2B_DEBUG = 'true'

  const config = new ConnectionConfig()

  assert.equal(
    config.getSandboxUrl('sbx-test', {
      sandboxDomain: 'e2b.app',
      envdPort: 49983,
    }),
    'http://localhost:49983'
  )
})

test('validateApiKey defaults to true', () => {
  delete process.env.E2B_VALIDATE_API_KEY

  const config = new ConnectionConfig()
  assert.equal(config.validateApiKey, true)
})

test('validateApiKey disabled via env var', () => {
  process.env.E2B_VALIDATE_API_KEY = 'false'

  const config = new ConnectionConfig()
  assert.equal(config.validateApiKey, false)
})

test('validateApiKey in args has priority over env var', () => {
  process.env.E2B_VALIDATE_API_KEY = 'true'

  const config = new ConnectionConfig({ validateApiKey: false })
  assert.equal(config.validateApiKey, false)
})

test('debug false in args overrides E2B_DEBUG env var', () => {
  process.env.E2B_DEBUG = 'true'

  const config = new ConnectionConfig({ debug: false })
  assert.equal(config.debug, false)
})

test('debug defaults to E2B_DEBUG env var', () => {
  process.env.E2B_DEBUG = 'true'

  const config = new ConnectionConfig()
  assert.equal(config.debug, true)
})

test('setIntegration appends the integration to the user agent', () => {
  ConnectionConfig.setIntegration('testing/version')
  const config = new ConnectionConfig()

  assert.equal(config.headers?.['User-Agent']?.startsWith('e2b-js-sdk/'), true)
  assert.equal(
    config.headers?.['User-Agent']?.endsWith(' testing/version'),
    true
  )
})

test('integration survives config rebuilds', () => {
  ConnectionConfig.setIntegration('testing/version')
  const config = new ConnectionConfig()
  const rebuiltConfig = new ConnectionConfig({ ...config })

  assert.equal(
    rebuiltConfig.headers?.['User-Agent']?.endsWith(' testing/version'),
    true
  )
})

test('setIntegration does not retro-tag configs built earlier', () => {
  const before = new ConnectionConfig()
  ConnectionConfig.setIntegration('testing/version')
  const after = new ConnectionConfig()

  assert.equal(before.headers?.['User-Agent']?.includes('testing'), false)
  assert.equal(
    after.headers?.['User-Agent']?.endsWith(' testing/version'),
    true
  )
})

test('clearing the integration restores the plain user agent', () => {
  ConnectionConfig.setIntegration('testing/version')
  ConnectionConfig.setIntegration(undefined)
  const config = new ConnectionConfig()

  assert.equal(config.headers?.['User-Agent']?.startsWith('e2b-js-sdk/'), true)
  assert.equal(config.headers?.['User-Agent']?.includes('testing'), false)
})

test('custom user agent is preserved without integration', () => {
  const config = new ConnectionConfig({
    apiHeaders: { 'User-Agent': 'my-app/1.0' },
  })

  assert.equal(config.headers?.['User-Agent'], 'my-app/1.0')
})

test('custom user agent wins over integration', () => {
  ConnectionConfig.setIntegration('testing/version')

  const config = new ConnectionConfig({
    headers: { 'User-Agent': 'my-app/1.0' },
  })

  assert.equal(config.headers?.['User-Agent'], 'my-app/1.0')
})

test('custom user agent survives config rebuilds', () => {
  ConnectionConfig.setIntegration('testing/version')
  const config = new ConnectionConfig({
    apiHeaders: { 'User-Agent': 'my-app/1.0' },
  })
  const rebuiltConfig = new ConnectionConfig({ ...config })

  assert.equal(rebuiltConfig.headers?.['User-Agent'], 'my-app/1.0')
})

test('clearing the integration propagates to config rebuilds', () => {
  ConnectionConfig.setIntegration('testing/version')
  const config = new ConnectionConfig()
  ConnectionConfig.setIntegration(undefined)
  const rebuiltConfig = new ConnectionConfig({ ...config })

  assert.equal(
    rebuiltConfig.headers?.['User-Agent']?.startsWith('e2b-js-sdk/'),
    true
  )
  assert.equal(
    rebuiltConfig.headers?.['User-Agent']?.includes('testing'),
    false
  )
})

test('getSignal returns user signal when no timeout is set', () => {
  const config = new ConnectionConfig({ requestTimeoutMs: 0 })
  const controller = new AbortController()
  const signal = config.getSignal(0, controller.signal)
  assert.strictEqual(signal, controller.signal)
})

test('getSignal aborts when user signal is aborted', () => {
  const config = new ConnectionConfig({ requestTimeoutMs: 60_000 })
  const controller = new AbortController()
  const signal = config.getSignal(undefined, controller.signal)
  assert.ok(signal)
  assert.equal(signal!.aborted, false)
  controller.abort()
  assert.equal(signal!.aborted, true)
})

test('getSignal returns timeout signal when no user signal is provided', () => {
  const config = new ConnectionConfig({ requestTimeoutMs: 60_000 })
  const signal = config.getSignal()
  assert.ok(signal)
  assert.equal(signal!.aborted, false)
})

test('getSignal returns undefined when no timeout and no signal', () => {
  const config = new ConnectionConfig({ requestTimeoutMs: 0 })
  const signal = config.getSignal(0)
  assert.equal(signal, undefined)
})

test('requestTimeoutMs 0 from the config disables the timeout', () => {
  const config = new ConnectionConfig({ requestTimeoutMs: 0 })
  // The stored value is kept as 0 (not replaced by the default).
  assert.equal(config.requestTimeoutMs, 0)
  // getSignal() with no per-call arg falls back to the stored 0, which must
  // NOT produce a timeout signal.
  assert.equal(config.getSignal(), undefined)
  // With only a user signal, no timeout signal is layered on top.
  const controller = new AbortController()
  assert.strictEqual(
    config.getSignal(undefined, controller.signal),
    controller.signal
  )
})

test('setupRequestController with config timeout 0 never auto-aborts', async () => {
  const config = new ConnectionConfig({ requestTimeoutMs: 0 })
  const { controller } = setupRequestController(
    config.requestTimeoutMs,
    undefined
  )
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(controller.signal.aborted, false)
})

test('setupRequestController aborts when user signal aborts', () => {
  const userController = new AbortController()
  const { controller } = setupRequestController(0, userController.signal)

  assert.equal(controller.signal.aborted, false)
  userController.abort()
  assert.equal(controller.signal.aborted, true)
})

test('setupRequestController is already aborted when user signal was pre-aborted', () => {
  const userController = new AbortController()
  userController.abort()

  const { controller } = setupRequestController(0, userController.signal)
  assert.equal(controller.signal.aborted, true)
})

test('setupRequestController cleanup removes the user-signal listener', () => {
  const userController = new AbortController()
  const { controller, cleanup } = setupRequestController(
    0,
    userController.signal
  )

  cleanup()
  // Internal controller is aborted by cleanup, so it stays aborted.
  assert.equal(controller.signal.aborted, true)

  // After cleanup the listener is detached — a subsequent abort on the
  // user signal must not propagate (verified indirectly: cleanup is
  // idempotent and no error is thrown).
  userController.abort()
  cleanup()
})

test('setupRequestController clearStartTimeout stops the handshake timer', async () => {
  const { controller, clearStartTimeout } = setupRequestController(
    20,
    undefined
  )
  clearStartTimeout()
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(controller.signal.aborted, false)
})

test('setupRequestController handshake timer aborts when not cleared', async () => {
  const { controller } = setupRequestController(20, undefined)
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(controller.signal.aborted, true)
})

test('setupRequestController handshake timeout aborts with TimeoutError reason', async () => {
  const { controller } = setupRequestController(20, undefined)
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(controller.signal.aborted, true)
  assert.ok(controller.signal.reason instanceof DOMException)
  assert.equal((controller.signal.reason as DOMException).name, 'TimeoutError')
})

test('setupRequestController keeps the winning abort reason when a later abort races', async () => {
  const userController = new AbortController()
  const { controller } = setupRequestController(20, userController.signal)
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(controller.signal.aborted, true)

  // A user abort arriving after the timeout already aborted must not disturb
  // the committed reason (on Bun: nor steal the pin keeping it alive).
  userController.abort(new Error('user cancel'))
  await new Promise((resolve) => setTimeout(resolve, 20))

  assert.ok(controller.signal.reason instanceof DOMException)
  assert.equal((controller.signal.reason as DOMException).name, 'TimeoutError')
})

test('setupRequestController user signal still cancels after clearStartTimeout', () => {
  const userController = new AbortController()
  const { controller, clearStartTimeout } = setupRequestController(
    60_000,
    userController.signal
  )
  clearStartTimeout()
  assert.equal(controller.signal.aborted, false)
  userController.abort()
  assert.equal(controller.signal.aborted, true)
})

// Builds a source ReadableStream that records whether its underlying reader was
// cancelled, standing in for a fetch response body backed by a pooled
// connection. `cancel` being invoked is what releases that connection.
function trackedSource() {
  const state: { cancelled: boolean; cancelReason: unknown } = {
    cancelled: false,
    cancelReason: undefined,
  }
  const chunks = ['a', 'b'].map((s) => new TextEncoder().encode(s))
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++])
      } else {
        controller.close()
      }
    },
    cancel(reason) {
      state.cancelled = true
      state.cancelReason = reason
    },
  })
  return { body, state }
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  let out = ''
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  return out
}

// Builds a source ReadableStream that never produces a chunk and errors its
// pending read when `signal` aborts, standing in for a stalled fetch response
// body whose connection is torn down by aborting the request controller.
function stallingSource(signal: AbortSignal) {
  const state: { cancelled: boolean } = { cancelled: false }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal.addEventListener('abort', () => controller.error(signal.reason), {
        once: true,
      })
    },
    cancel() {
      state.cancelled = true
    },
  })
  return { body, state }
}

test('wrapStreamWithConnectionCleanup releases once on full read', async () => {
  const { body } = trackedSource()
  let cleanups = 0
  const stream = wrapStreamWithConnectionCleanup(body, {
    clearStartTimeout: () => {},
    cleanup: () => {
      cleanups++
    },
    controller: new AbortController(),
  })
  assert.equal(await readAll(stream), 'ab')
  assert.equal(cleanups, 1)
})

test('wrapStreamWithConnectionCleanup cancel cancels the underlying reader', async () => {
  const { body, state } = trackedSource()
  let cleanups = 0
  const stream = wrapStreamWithConnectionCleanup(body, {
    clearStartTimeout: () => {},
    cleanup: () => {
      cleanups++
    },
    controller: new AbortController(),
  })
  await stream.cancel('done')
  assert.equal(state.cancelled, true)
  assert.equal(state.cancelReason, 'done')
  assert.equal(cleanups, 1)
})

test('wrapStreamWithConnectionCleanup handles a null body', async () => {
  let cleanups = 0
  let cleared = 0
  const stream = wrapStreamWithConnectionCleanup(null, {
    clearStartTimeout: () => {
      cleared++
    },
    cleanup: () => {
      cleanups++
    },
    controller: new AbortController(),
  })
  assert.equal(cleared, 1)
  assert.equal(cleanups, 1)
  assert.equal(await readAll(stream), '')
})

test('wrapStreamWithConnectionCleanup aborts and releases an idle stream', async () => {
  const controller = new AbortController()
  const { body } = stallingSource(controller.signal)
  let cleanups = 0
  const stream = wrapStreamWithConnectionCleanup(body, {
    clearStartTimeout: () => {},
    cleanup: () => {
      cleanups++
    },
    controller,
    idleTimeoutMs: 20,
  })

  // No chunk ever arrives, so the idle timer fires, aborts the controller,
  // and the read rejects with the TimeoutError reason.
  let error: unknown
  try {
    await readAll(stream)
  } catch (err) {
    error = err
  }
  assert.equal((error as DOMException)?.name, 'TimeoutError')
  assert.equal(cleanups, 1)
  assert.equal(controller.signal.aborted, true)
})

test('wrapStreamWithConnectionCleanup with idle timeout 0 never auto-aborts', async () => {
  const { body } = trackedSource()
  let cleanups = 0
  const stream = wrapStreamWithConnectionCleanup(body, {
    clearStartTimeout: () => {},
    cleanup: () => {
      cleanups++
    },
    controller: new AbortController(),
    idleTimeoutMs: 0,
  })
  assert.equal(await readAll(stream), 'ab')
  assert.equal(cleanups, 1)
})

test('wrapStreamWithConnectionCleanup does not abort a slow consumer (wire-only)', async () => {
  // Source has both chunks ready immediately; the consumer pauses far longer
  // than the idle timeout between reads. Because the timer is armed only around
  // the network read and cleared as soon as a chunk arrives, the consumer's
  // pace must not trip it.
  const controller = new AbortController()
  const { body } = trackedSource()
  const stream = wrapStreamWithConnectionCleanup(body, {
    clearStartTimeout: () => {},
    cleanup: () => {},
    controller,
    idleTimeoutMs: 20,
  })
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  const first = await reader.read()
  assert.equal(decoder.decode(first.value), 'a')
  await new Promise((resolve) => setTimeout(resolve, 50))
  const second = await reader.read()
  assert.equal(decoder.decode(second.value), 'b')
  assert.equal(controller.signal.aborted, false)
})
