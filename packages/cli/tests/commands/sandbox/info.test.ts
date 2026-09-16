import { afterEach, describe, expect, test, vi } from 'vitest'
import { SidecarInfo } from 'e2b'

import {
  formatSidecarTable,
  renderPrettyInfo,
} from '../../../src/commands/sandbox/info'

const sidecars: SidecarInfo[] = [
  {
    entry: 'valkey',
    version: '7.4.1',
    role: 'service',
    class: 'stateful',
    state: 'running',
    name: 'valkey.sidecar.e2b.local',
    address: '169.254.0.25',
    ports: [6379],
  },
  {
    entry: 'iron-proxy',
    version: '0.4.1',
    role: 'proxy',
    class: 'stateful',
    state: 'failed',
    name: 'iron-proxy.sidecar.e2b.local',
    lastError: 'readiness probe timed out',
  },
]

function capture() {
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((line: string) =>
    lines.push(line)
  )
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  return lines
}

describe('sandbox info sidecars', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('formats a table with entry, version, role, class, state, name, address, ports and last error', () => {
    expect(formatSidecarTable(sidecars)).toEqual([
      'ENTRY        VERSION   ROLE      CLASS      STATE     NAME                           ADDRESS        PORTS   LAST ERROR',
      'valkey       7.4.1     service   stateful   running   valkey.sidecar.e2b.local       169.254.0.25   6379',
      'iron-proxy   0.4.1     proxy     stateful   failed    iron-proxy.sidecar.e2b.local                          readiness probe timed out',
    ])
  })

  test('truncates a long last error to 60 characters with an ellipsis', () => {
    const lastError = 'x'.repeat(70)
    const [, row] = formatSidecarTable([{ ...sidecars[1], lastError }])

    expect(row.endsWith(`${'x'.repeat(59)}…`)).toBe(true)
    expect(row).not.toContain('x'.repeat(60))
  })

  test('prints the sidecar table indented under its label', () => {
    const output = capture()

    renderPrettyInfo({ sandboxId: 'sbx-1', sidecars })

    // The label and its indented table go out as one multi-line log call.
    const lines = output.join('\n').split('\n')
    const start = lines.findIndex((line) => line.includes('Sidecars'))
    expect(start).toBeGreaterThan(0)
    expect(lines[start + 1]).toMatch(/^  ENTRY\s+VERSION/)
    expect(lines[start + 2]).toMatch(/^  valkey\s+7\.4\.1/)
    expect(lines[start + 3]).toMatch(/^  iron-proxy\s+0\.4\.1/)
  })

  test('omits the sidecars field when the sandbox has none', () => {
    const lines = capture()

    renderPrettyInfo({ sandboxId: 'sbx-1', sidecars: [] })

    expect(lines.some((line) => line.includes('Sidecars'))).toBe(false)
  })
})
