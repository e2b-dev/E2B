import { describe, expect, test } from 'vitest'

import { formatSecretRow } from '../../../src/commands/secret/commands'

function secret(overrides: Partial<Parameters<typeof formatSecretRow>[0]> = {}) {
  return {
    secretId: 'secret-id',
    name: 'API_KEY',
    version: 1,
    metadata: {},
    createdAt: new Date('2026-10-14T10:00:00Z'),
    updatedAt: new Date('2026-10-14T10:00:00Z'),
    ...overrides,
  }
}

describe('secret list table rows', () => {
  test('stringifies metadata for display', () => {
    const row = formatSecretRow(
      secret({ metadata: { env: 'prod', owner: 'team-a' } })
    )

    expect(row.metadata).toBe('{"env":"prod","owner":"team-a"}')
  })

  test('formats timestamps as locale strings', () => {
    const createdAt = new Date('2026-10-14T10:00:00Z')
    const updatedAt = new Date('2026-10-15T12:00:00Z')
    const row = formatSecretRow(
      secret({ createdAt, updatedAt })
    )

    expect(row.createdAt).toBe(createdAt.toLocaleString())
    expect(row.updatedAt).toBe(updatedAt.toLocaleString())
  })

  test('preserves id, name, and version', () => {
    const row = formatSecretRow(
      secret({ secretId: 's-123', name: 'DB_PASSWORD', version: 3 })
    )

    expect(row.secretId).toBe('s-123')
    expect(row.name).toBe('DB_PASSWORD')
    expect(row.version).toBe(3)
  })

  test('does not mutate the input', () => {
    const input = secret()
    formatSecretRow(input)

    expect(input.metadata).toEqual({})
    expect(input.createdAt).toEqual(new Date('2026-10-14T10:00:00Z'))
  })
})
