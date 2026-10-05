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
  for (const key of ['E2B_SANDBOX_URL', 'E2B_DEBUG']) {
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

test('jupyterUrl points directly to the sandbox host by default', () => {
  const sandbox = createSandbox({ domain: 'example.dev' })
  expect(sandbox.jupyterUrl).toBe('https://49999-test-sandbox-id.example.dev')
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
