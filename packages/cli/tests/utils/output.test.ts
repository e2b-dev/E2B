import { describe, expect, test, vi } from 'vitest'

import {
  OutputFormat,
  printJson,
  printNames,
  printYaml,
  resolveOutputFormat,
} from '../../src/utils/output'

describe('output helpers', () => {
  test('resolves default, kubectl-style output, and legacy format values', () => {
    expect(resolveOutputFormat({})).toBe(OutputFormat.PRETTY)
    expect(resolveOutputFormat({ output: 'json' })).toBe(OutputFormat.JSON)
    expect(resolveOutputFormat({ output: 'yaml' })).toBe(OutputFormat.YAML)
    expect(resolveOutputFormat({ output: 'name' })).toBe(OutputFormat.NAME)
    expect(resolveOutputFormat({ output: 'table' })).toBe(OutputFormat.PRETTY)
    expect(resolveOutputFormat({ format: 'json' })).toBe(OutputFormat.JSON)
  })

  test('prefers output over legacy format', () => {
    expect(resolveOutputFormat({ output: 'yaml', format: 'json' })).toBe(
      OutputFormat.YAML
    )
  })

  test('throws for unsupported output formats', () => {
    expect(() => resolveOutputFormat({ output: 'xml' })).toThrow(
      'Unsupported output format: xml'
    )
  })

  test('prints json', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    printJson({ sandboxId: 'sbx_123' })

    expect(log).toHaveBeenCalledWith('{\n  "sandboxId": "sbx_123"\n}')
    log.mockRestore()
  })

  test('prints yaml', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    printYaml({ sandboxId: 'sbx_123' })

    expect(write).toHaveBeenCalledWith('sandboxId: sbx_123\n')
    write.mockRestore()
  })

  test('prints names', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    printNames([{ sandboxId: 'sbx_123' }], (sandbox) => {
      return `sandbox/${sandbox.sandboxId}`
    })

    expect(log).toHaveBeenCalledWith('sandbox/sbx_123')
    log.mockRestore()
  })
})
