import { describe, expect, test } from 'vitest'
import { validateRelativePath } from '../../../src/template/utils'
import { TemplateError } from '../../../src/errors'

describe('validateRelativePath', () => {
  describe('valid paths', () => {
    test('accepts simple relative path', () => {
      expect(() => validateRelativePath('foo', undefined)).not.toThrow()
    })

    test('accepts nested relative path', () => {
      expect(() => validateRelativePath('foo/bar', undefined)).not.toThrow()
    })

    test('accepts path with ./ prefix', () => {
      expect(() => validateRelativePath('./foo', undefined)).not.toThrow()
    })

    test('accepts nested path with ./ prefix', () => {
      expect(() => validateRelativePath('./foo/bar', undefined)).not.toThrow()
    })

    test('accepts path with internal parent ref that stays within context', () => {
      expect(() => validateRelativePath('foo/../bar', undefined)).not.toThrow()
    })

    test('accepts current directory', () => {
      expect(() => validateRelativePath('.', undefined)).not.toThrow()
    })

    test('accepts glob patterns', () => {
      expect(() => validateRelativePath('*.txt', undefined)).not.toThrow()
      expect(() => validateRelativePath('**/*.ts', undefined)).not.toThrow()
      expect(() => validateRelativePath('src/**/*', undefined)).not.toThrow()
    })

    test('accepts hidden files and directories', () => {
      expect(() => validateRelativePath('.hidden', undefined)).not.toThrow()
      expect(() =>
        validateRelativePath('.config/settings', undefined)
      ).not.toThrow()
    })

    test('accepts filenames starting with double dots', () => {
      expect(() => validateRelativePath('..myconfig', undefined)).not.toThrow()
      expect(() => validateRelativePath('..cache', undefined)).not.toThrow()
      expect(() =>
        validateRelativePath('...something', undefined)
      ).not.toThrow()
      expect(() =>
        validateRelativePath('foo/..myconfig', undefined)
      ).not.toThrow()
    })
  })

  describe('invalid paths - absolute', () => {
    test('rejects Unix absolute path', () => {
      expect(() => validateRelativePath('/absolute/path', undefined)).toThrow(
        TemplateError
      )
      expect(() => validateRelativePath('/absolute/path', undefined)).toThrow(
        'absolute paths are not allowed'
      )
    })

    test('rejects root path', () => {
      expect(() => validateRelativePath('/', undefined)).toThrow(TemplateError)
    })

    // Windows path tests - using path.win32.isAbsolute ensures cross-platform detection
    test('rejects Windows drive letter path', () => {
      expect(() =>
        validateRelativePath('C:\\Windows\\System32', undefined)
      ).toThrow(TemplateError)
      expect(() =>
        validateRelativePath('C:\\Windows\\System32', undefined)
      ).toThrow('absolute paths are not allowed')
    })

    test('rejects Windows UNC path', () => {
      expect(() =>
        validateRelativePath('\\\\server\\share', undefined)
      ).toThrow(TemplateError)
    })
  })

  describe('invalid paths - parent directory escape', () => {
    test('rejects simple parent directory escape', () => {
      expect(() => validateRelativePath('../foo', undefined)).toThrow(
        TemplateError
      )
      expect(() => validateRelativePath('../foo', undefined)).toThrow(
        'path escapes the context directory'
      )
    })

    test('rejects parent directory escape with forward slash', () => {
      expect(() => validateRelativePath('../file.txt', undefined)).toThrow(
        TemplateError
      )
    })

    test('rejects parent directory escape with backslash', () => {
      expect(() => validateRelativePath('..\\file.txt', undefined)).toThrow(
        TemplateError
      )
    })

    test('rejects double parent directory escape', () => {
      expect(() => validateRelativePath('../../foo', undefined)).toThrow(
        TemplateError
      )
    })

    test('rejects path that escapes via nested parent refs', () => {
      expect(() => validateRelativePath('foo/../../bar', undefined)).toThrow(
        TemplateError
      )
    })

    test('rejects path with ./ prefix that escapes', () => {
      expect(() =>
        validateRelativePath('./foo/../../../bar', undefined)
      ).toThrow(TemplateError)
    })

    test('rejects just parent directory', () => {
      expect(() => validateRelativePath('..', undefined)).toThrow(TemplateError)
    })

    test('rejects current directory followed by parent', () => {
      expect(() => validateRelativePath('./..', undefined)).toThrow(
        TemplateError
      )
    })

    test('rejects deeply nested escape', () => {
      expect(() =>
        validateRelativePath('a/b/c/../../../../escape', undefined)
      ).toThrow(TemplateError)
    })
  })

  describe('error messages include path', () => {
    test('absolute path error includes the path', () => {
      try {
        validateRelativePath('/etc/passwd', undefined)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e.message).toContain('/etc/passwd')
      }
    })

    test('escape path error includes the path', () => {
      try {
        validateRelativePath('../secret', undefined)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e.message).toContain('../secret')
      }
    })
  })
})
