import { describe, expect, test } from 'vitest'
import { normalizeBuildArguments } from '../../../src/template/utils'
import { TemplateError } from '../../../src/errors'

describe('normalizeBuildArguments', () => {
  test('handles string name', () => {
    const result = normalizeBuildArguments('my-template:v1.0')
    expect(result.names).toEqual(['my-template:v1.0'])
  })

  test('handles array of names', () => {
    const result = normalizeBuildArguments([
      'my-template:v1.0',
      'my-template:latest',
    ])
    expect(result.names).toEqual(['my-template:v1.0', 'my-template:latest'])
  })

  test('handles legacy options with alias', () => {
    const result = normalizeBuildArguments({ alias: 'my-template' })
    expect(result.names).toEqual(['my-template'])
  })

  test('removes alias from build options', () => {
    const result = normalizeBuildArguments({
      alias: 'my-template',
      cpuCount: 4,
    })
    expect(result.names).toEqual(['my-template'])
    expect(result.buildOptions).toEqual({ cpuCount: 4 })
    expect(result.buildOptions).not.toHaveProperty('alias')
  })

  test('throws for empty names array', () => {
    expect(() => normalizeBuildArguments([])).toThrow(TemplateError)
  })
})
