import { afterEach, beforeEach, expect, test } from 'vitest'

import { Sandbox } from '../src'

// Constructing a sandbox instance makes no network requests, so URL
// resolution can be tested without a live sandbox.
function createSandbox(opts: object = {}) {
  const SandboxClass = Sandbox as unknown as new (opts: object) => Sandbox
  const sandbox = new SandboxClass({
    sandboxId: 'test-sandbox-id',
    envdVersion: '0.2.0',
    ...opts,
  })
  return sandbox as unknown as { jupyterUrl: string }
}

const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ['E2B_SANDBOX_URL', 'E2B_DEBUG', 'E2B_DOMAIN']) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

test('jupyterUrl uses the unified sandbox endpoint on supported domains', () => {
  const sandbox = createSandbox({ domain: 'e2b.app' })
  expect(sandbox.jupyterUrl).toBe('https://sandbox.e2b.app')
})

test('jupyterUrl prefers the sandbox domain over the config domain', () => {
  const sandbox = createSandbox({
    domain: 'e2b.app',
    sandboxDomain: 'e2b.dev',
  })
  expect(sandbox.jupyterUrl).toBe('https://sandbox.e2b.dev')
})

test('jupyterUrl points to the per-port sandbox host on unsupported domains', () => {
  const sandbox = createSandbox({ domain: 'example.dev' })
  expect(sandbox.jupyterUrl).toBe('https://49999-test-sandbox-id.example.dev')
})

test('jupyterUrl points to localhost in debug mode', () => {
  const sandbox = createSandbox({ debug: true })
  expect(sandbox.jupyterUrl).toBe('http://localhost:49999')
})

test('jupyterUrl honors the sandboxUrl option', () => {
  const sandbox = createSandbox({ sandboxUrl: 'https://proxy.example.com' })
  expect(sandbox.jupyterUrl).toBe('https://proxy.example.com')
})

test('jupyterUrl honors the E2B_SANDBOX_URL environment variable', () => {
  process.env.E2B_SANDBOX_URL = 'https://env.example.com'
  const sandbox = createSandbox()
  expect(sandbox.jupyterUrl).toBe('https://env.example.com')
})
