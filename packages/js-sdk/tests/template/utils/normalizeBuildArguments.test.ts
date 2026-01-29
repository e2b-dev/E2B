import { describe, expect, test } from 'vitest'
import { normalizeBuildArguments } from '../../../src/template/utils'
import { TemplateError } from '../../../src/errors'

describe('normalizeBuildArguments', () => {
  test('handles string name', () => {
    const result = normalizeBuildArguments('my-template:v1.0')
    expect(result.name).toBe('my-template:v1.0')
  })

  test('handles string name with options', () => {
    const result = normalizeBuildArguments('my-template:v1.0', { cpuCount: 4 })
    expect(result.name).toBe('my-template:v1.0')
    expect(result.buildOptions).toEqual({ cpuCount: 4 })
  })

  test('handles legacy options with alias', () => {
    const result = normalizeBuildArguments({ alias: 'my-template' })
    expect(result.name).toBe('my-template')
  })

  test('removes alias from build options', () => {
    const result = normalizeBuildArguments({
      alias: 'my-template',
      cpuCount: 4,
    })
    expect(result.name).toBe('my-template')
    expect(result.buildOptions).toEqual({ cpuCount: 4 })
    expect(result.buildOptions).not.toHaveProperty('alias')
  })

  test('throws for empty name', () => {
    expect(() => normalizeBuildArguments({ alias: '' })).toThrow(TemplateError)
  })

  test('throws for missing name', () => {
    expect(() => normalizeBuildArguments({} as any)).toThrow(TemplateError)
  })
})
