import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox, SandboxNotFoundError } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

// The control plane can answer with a status-only response (no JSON body).
// openapi-fetch leaves `res.error` undefined in that case, so every short-circuit
// has to read the HTTP status rather than the parsed error body.
const sandboxId = 'missing-sandbox-id'
const emptyBody = (status: number) => () => new HttpResponse(null, { status })

const server = setupServer(
  http.delete(apiUrl(`/sandboxes/${sandboxId}`), emptyBody(404)),
  http.get(apiUrl(`/sandboxes/${sandboxId}`), emptyBody(404)),
  http.get(apiUrl(`/sandboxes/${sandboxId}/metrics`), emptyBody(404)),
  http.post(apiUrl(`/sandboxes/${sandboxId}/timeout`), emptyBody(404)),
  http.put(apiUrl(`/sandboxes/${sandboxId}/network`), emptyBody(404)),
  http.post(apiUrl(`/sandboxes/${sandboxId}/snapshots`), emptyBody(404)),
  http.post(apiUrl(`/sandboxes/${sandboxId}/connect`), emptyBody(404)),
  http.delete(apiUrl('/templates/missing-snapshot-id'), emptyBody(404)),
  http.post(apiUrl('/sandboxes/paused-sandbox-id/pause'), emptyBody(409))
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

const opts = { apiKey: TEST_API_KEY }

test('kill returns false on a body-less 404', async () => {
  await expect(Sandbox.kill(sandboxId, opts)).resolves.toBe(false)
})

test('deleteSnapshot returns false on a body-less 404', async () => {
  await expect(
    Sandbox.deleteSnapshot('missing-snapshot-id', opts)
  ).resolves.toBe(false)
})

test('pause returns false on a body-less 409', async () => {
  await expect(Sandbox.pause('paused-sandbox-id', opts)).resolves.toBe(false)
})

test('getInfo throws SandboxNotFoundError on a body-less 404', async () => {
  await expect(Sandbox.getInfo(sandboxId, opts)).rejects.toBeInstanceOf(
    SandboxNotFoundError
  )
})

test('getMetrics throws SandboxNotFoundError on a body-less 404', async () => {
  await expect(Sandbox.getMetrics(sandboxId, opts)).rejects.toBeInstanceOf(
    SandboxNotFoundError
  )
})

test('setTimeout throws SandboxNotFoundError on a body-less 404', async () => {
  await expect(
    Sandbox.setTimeout(sandboxId, 60_000, opts)
  ).rejects.toBeInstanceOf(SandboxNotFoundError)
})

test('updateNetwork throws SandboxNotFoundError on a body-less 404', async () => {
  await expect(
    Sandbox.updateNetwork(sandboxId, {}, opts)
  ).rejects.toBeInstanceOf(SandboxNotFoundError)
})

test('createSnapshot throws SandboxNotFoundError on a body-less 404', async () => {
  await expect(Sandbox.createSnapshot(sandboxId, opts)).rejects.toBeInstanceOf(
    SandboxNotFoundError
  )
})

test('connect throws SandboxNotFoundError on a body-less 404', async () => {
  await expect(Sandbox.connect(sandboxId, opts)).rejects.toBeInstanceOf(
    SandboxNotFoundError
  )
})
