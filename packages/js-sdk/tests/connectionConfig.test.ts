import { assert, test, beforeEach, afterEach } from 'vitest'
import { ConnectionConfig } from '../src/connectionConfig'

// Store original env vars to restore after tests
let originalEnv: { [key: string]: string | undefined }

beforeEach(() => {
  originalEnv = {
    E2B_API_URL: process.env.E2B_API_URL,
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
