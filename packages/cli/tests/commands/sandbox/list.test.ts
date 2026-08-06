import { describe, expect, test } from 'vitest'
import { SandboxInfo } from 'e2b'

import { buildTableRows } from '../../../src/commands/sandbox/list'

function sandbox(sandboxId: string, startedAt: Date): SandboxInfo {
  return {
    sandboxId,
    templateId: 'template-id',
    metadata: {},
    startedAt,
    endAt: new Date(startedAt.getTime() + 60_000),
    state: 'running',
    cpuCount: 2,
    memoryMB: 512,
    envdVersion: '0.2.0',
  }
}

describe('sandbox list table rows', () => {
  test('sorts by timestamp, not by locale-formatted date string', () => {
    // In en-US, "9/1/2026, ..." > "10/1/2026, ..." lexicographically,
    // so string sorting would put September after October.
    const september = sandbox('sbx-sep', new Date('2026-09-01T10:00:00Z'))
    const october = sandbox('sbx-oct', new Date('2026-10-01T09:00:00Z'))

    const rows = buildTableRows([october, september])

    expect(rows.map((r) => r.sandboxId)).toEqual(['sbx-sep', 'sbx-oct'])
  })

  test('breaks ties on identical timestamps by sandbox ID', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const rows = buildTableRows([
      sandbox('sbx-b', startedAt),
      sandbox('sbx-a', startedAt),
    ])

    expect(rows.map((r) => r.sandboxId)).toEqual(['sbx-a', 'sbx-b'])
  })

  test('formats dates and state for display', () => {
    const startedAt = new Date('2026-09-01T10:00:00Z')
    const [row] = buildTableRows([sandbox('sbx-1', startedAt)])

    expect(row.startedAt).toBe(startedAt.toLocaleString())
    expect(row.state).toBe('Running')
    expect(row.metadata).toBe('{}')
  })

  test('does not mutate the input array', () => {
    const september = sandbox('sbx-sep', new Date('2026-09-01T10:00:00Z'))
    const october = sandbox('sbx-oct', new Date('2026-10-01T09:00:00Z'))
    const input = [october, september]

    buildTableRows(input)

    expect(input.map((s) => s.sandboxId)).toEqual(['sbx-oct', 'sbx-sep'])
  })
})
