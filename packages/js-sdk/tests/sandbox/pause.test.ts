import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import {
  Sandbox,
  SandboxError,
  SandboxNotFoundError,
  SandboxPauseRefusedError,
  ServiceBusyError,
} from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

const server = setupMockApi()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  requests = 0
  server.resetHandlers()
})

let requests = 0

function pauseAnswers(status: number, body?: unknown) {
  server.use(
    http.post(apiUrl('/sandboxes/:sandboxID/pause'), () => {
      requests++
      return body === undefined
        ? new HttpResponse(null, { status })
        : HttpResponse.json(body, { status })
    })
  )
}

test('a 200 with forced false resolves to paused, not forced', async () => {
  pauseAnswers(200, { forced: false })

  await expect(
    Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })
  ).resolves.toEqual({ paused: true, forced: false })
})

test('a 200 with forced true resolves to paused and forced', async () => {
  pauseAnswers(200, { forced: true })

  await expect(
    Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY, force: true })
  ).resolves.toEqual({ paused: true, forced: true })
})

test('forced reports what the API did, not the option: a forced request that joined a normal pause is not forced', async () => {
  pauseAnswers(200, { forced: false })

  await expect(
    Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY, force: true })
  ).resolves.toEqual({ paused: true, forced: false })
})

test('a 204 from an older API resolves to paused, not forced', async () => {
  pauseAnswers(204)

  await expect(
    Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })
  ).resolves.toEqual({ paused: true, forced: false })
})

test('an already paused sandbox (409) resolves to not paused', async () => {
  pauseAnswers(409, { code: 409, message: 'Sandbox is already paused' })

  await expect(
    Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })
  ).resolves.toEqual({ paused: false, forced: false })
})

test('the instance method returns the same result', async () => {
  server.use(
    http.post(apiUrl('/v2/sandboxes/:sandboxID/connect'), () =>
      HttpResponse.json({
        sandboxID: 'test-sandbox-id',
        templateID: 'base',
        envdVersion: '0.2.4',
      })
    )
  )
  pauseAnswers(200, { forced: true })
  const sandbox = await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
  })

  await expect(sandbox.pause({ force: true })).resolves.toEqual({
    paused: true,
    forced: true,
  })
})

test('a refused pause (503 sandbox_pause_refused) is a SandboxPauseRefusedError carrying the API message, after one request', async () => {
  const message =
    "Sandbox 'test-sandbox-id' cannot be paused right now because the sandbox guest agent is not responding: retry, or pause with force to take the snapshot without the health check"
  pauseAnswers(503, {
    code: 503,
    error_code: 'sandbox_pause_refused',
    message,
  })

  const err = await Sandbox.pause('test-sandbox-id', {
    apiKey: TEST_API_KEY,
  }).catch((e) => e)

  expect(err).toBeInstanceOf(SandboxPauseRefusedError)
  // Subclass of the generic 503 error, so handlers written for it keep working.
  expect(err).toBeInstanceOf(ServiceBusyError)
  expect(err.name).toBe('SandboxPauseRefusedError')
  expect(err.statusCode).toBe(503)
  expect(err.errorCode).toBe('sandbox_pause_refused')
  // The API's message verbatim: it names the reason and what to do.
  expect(err.message).toBe(message)
  // A coded refusal is not replayed by the transport retries.
  expect(requests).toBe(1)
})

test('a refusal for a busy node carries the same code and the reason in the message', async () => {
  const message =
    "Sandbox 'test-sandbox-id' cannot be paused right now because its node is busy, please retry"
  pauseAnswers(503, {
    code: 503,
    error_code: 'sandbox_pause_refused',
    message,
  })

  const err = await Sandbox.pause('test-sandbox-id', {
    apiKey: TEST_API_KEY,
  }).catch((e) => e)

  expect(err).toBeInstanceOf(SandboxPauseRefusedError)
  expect(err.message).toBe(message)
})

test('a 503 with no error_code at all stays a plain ServiceBusyError', async () => {
  pauseAnswers(503, {
    code: 503,
    message:
      "Sandbox 'test-sandbox-id' cannot be paused right now because the server is shutting down, please retry",
  })

  const err = await Sandbox.pause('test-sandbox-id', {
    apiKey: TEST_API_KEY,
  }).catch((e) => e)

  expect(err).toBeInstanceOf(ServiceBusyError)
  expect(err).not.toBeInstanceOf(SandboxPauseRefusedError)
  expect(err.message).toContain('server is shutting down')
})

test('force on a filesystem-only pause (400) is a SandboxError carrying the status and message', async () => {
  pauseAnswers(400, {
    code: 400,
    message: 'force applies to memory pauses only',
  })

  const err = await Sandbox.pause('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    mode: 'filesystem',
    force: true,
  }).catch((e) => e)

  expect(err).toBeInstanceOf(SandboxError)
  expect(err.statusCode).toBe(400)
  expect(err.message).toContain('force applies to memory pauses only')
})

test('a missing sandbox (404) is a SandboxNotFoundError', async () => {
  pauseAnswers(404, { code: 404, message: 'Sandbox not found' })

  await expect(
    Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })
  ).rejects.toBeInstanceOf(SandboxNotFoundError)
})
