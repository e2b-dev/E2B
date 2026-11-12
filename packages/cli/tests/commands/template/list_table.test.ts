import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TemplateInfo } from 'e2b'

import { renderTemplateTable } from '../../../src/commands/template/list'

function template(
  templateId: string,
  extra: Partial<TemplateInfo>
): TemplateInfo {
  return {
    templateId,
    buildId: 'build-id',
    cpuCount: 2,
    memoryMB: 512,
    diskSizeMB: 1024,
    public: false,
    isDefault: false,
    names: [templateId],
    createdAt: new Date('2026-11-05T15:00:00Z'),
    updatedAt: new Date('2026-11-05T15:00:00Z'),
    spawnCount: 0,
    buildCount: 1,
    envdVersion: '0.2.0',
    buildStatus: 'ready',
    ...extra,
  }
}

describe('template list table', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows max vCPUs for resizable templates and leaves it empty otherwise', () => {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line)
    })

    renderTemplateTable([
      template('resizable', { maxCpuCount: 4 }),
      template('fixed', {}),
    ])

    const header = lines[0]
    const maxCpu = (line: string) =>
      line.slice(header.indexOf('MAX VCPUS'), header.indexOf('RAM MIB')).trim()
    expect(header).toContain('MAX VCPUS')
    expect(lines.map(maxCpu)).toEqual(['MAX VCPUS', '4', ''])
  })
})
