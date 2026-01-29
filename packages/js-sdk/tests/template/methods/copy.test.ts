import { describe, expect, test } from 'vitest'
import { Template } from '../../../src'
import { TemplateError } from '../../../src/errors'

describe('Template.copy validation', () => {
  describe('rejects invalid paths', () => {
    test('rejects absolute Unix path', () => {
      expect(() =>
        Template().fromBaseImage().copy('/etc/passwd', '/app')
      ).toThrow(TemplateError)
      expect(() =>
        Template().fromBaseImage().copy('/etc/passwd', '/app')
      ).toThrow('absolute paths are not allowed')
    })

    test('rejects parent directory escape', () => {
      expect(() =>
        Template().fromBaseImage().copy('../secret', '/app')
      ).toThrow(TemplateError)
      expect(() =>
        Template().fromBaseImage().copy('../secret', '/app')
      ).toThrow('path escapes the context directory')
    })

    test('rejects nested parent directory escape', () => {
      expect(() =>
        Template().fromBaseImage().copy('foo/../../bar', '/app')
      ).toThrow(TemplateError)
    })

    test('rejects escape via ./ prefix', () => {
      expect(() =>
        Template().fromBaseImage().copy('./foo/../../../bar', '/app')
      ).toThrow(TemplateError)
    })

    test('rejects just parent directory', () => {
      expect(() => Template().fromBaseImage().copy('..', '/app')).toThrow(
        TemplateError
      )
    })

    test('rejects absolute path in array', () => {
      expect(() =>
        Template()
          .fromBaseImage()
          .copy(['valid.txt', '/etc/passwd'], '/app')
      ).toThrow(TemplateError)
    })

    test('rejects escape path in array', () => {
      expect(() =>
        Template()
          .fromBaseImage()
          .copy(['valid.txt', '../secret'], '/app')
      ).toThrow(TemplateError)
    })
  })

  describe('accepts valid paths', () => {
    test('accepts simple relative path', () => {
      expect(() =>
        Template().fromBaseImage().copy('file.txt', '/app')
      ).not.toThrow()
    })

    test('accepts nested relative path', () => {
      expect(() =>
        Template().fromBaseImage().copy('src/file.txt', '/app')
      ).not.toThrow()
    })

    test('accepts path with ./ prefix', () => {
      expect(() =>
        Template().fromBaseImage().copy('./file.txt', '/app')
      ).not.toThrow()
    })

    test('accepts internal parent ref that stays within context', () => {
      expect(() =>
        Template().fromBaseImage().copy('foo/../bar.txt', '/app')
      ).not.toThrow()
    })

    test('accepts glob patterns', () => {
      expect(() =>
        Template().fromBaseImage().copy('*.txt', '/app')
      ).not.toThrow()
      expect(() =>
        Template().fromBaseImage().copy('**/*.ts', '/app')
      ).not.toThrow()
    })

    test('accepts current directory', () => {
      expect(() => Template().fromBaseImage().copy('.', '/app')).not.toThrow()
    })

    test('accepts array of valid paths', () => {
      expect(() =>
        Template()
          .fromBaseImage()
          .copy(['file1.txt', 'file2.txt'], '/app')
      ).not.toThrow()
    })
  })
})

describe('Template.copyItems validation', () => {
  test('rejects invalid paths', () => {
    expect(() =>
      Template()
        .fromBaseImage()
        .copyItems([{ src: '/etc/passwd', dest: '/app' }])
    ).toThrow(TemplateError)
  })

  test('rejects escape paths', () => {
    expect(() =>
      Template()
        .fromBaseImage()
        .copyItems([{ src: '../secret', dest: '/app' }])
    ).toThrow(TemplateError)
  })

  test('accepts valid paths', () => {
    expect(() =>
      Template()
        .fromBaseImage()
        .copyItems([{ src: 'file.txt', dest: '/app' }])
    ).not.toThrow()
  })
})
