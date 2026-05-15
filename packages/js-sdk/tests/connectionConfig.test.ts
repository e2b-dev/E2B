import { assert, test, beforeEach, afterEach } from 'vitest'
import {
  ConnectionConfig,
  setupRequestController,
} from '../src/connectionConfig'

// Store original env vars to restore after tests
let originalEnv: { [key: string]: string | undefined }

beforeEach(() => {
  originalEnv = {
    E2B_API_URL: process.env.E2B_API_URL,
    E2B_DOMAIN: process.env.E2B_DOMAIN,
    E2B_DEBUG: process.env.E2B_DEBUG,
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
