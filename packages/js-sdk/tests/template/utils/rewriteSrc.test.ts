import { expect, test, describe } from 'vitest'
import { rewriteSrc } from '../../../src/template/utils'

describe('rewriteSrc', () => {
  test('should return basename for parent directory paths', () => {
    expect(rewriteSrc('../file.txt')).toBe('file.txt')
    expect(rewriteSrc('../../config.json')).toBe('config.json')
    expect(rewriteSrc('../dir/file.py')).toBe('file.py')
  })

  test('should preserve relative paths', () => {
    expect(rewriteSrc('file.txt')).toBe('file.txt')
    expect(rewriteSrc('dir/file.txt')).toBe('dir/file.txt')
    expect(rewriteSrc('./file.txt')).toBe('./file.txt')
    expect(rewriteSrc('src/components/Button.tsx')).toBe(
      'src/components/Button.tsx'
    )
  })

  test('should preserve absolute paths', () => {
    expect(rewriteSrc('/usr/local/file.txt')).toBe('/usr/local/file.txt')
    expect(rewriteSrc('/home/user/project/file.py')).toBe(
      '/home/user/project/file.py'
    )
  })

  test('should handle glob patterns', () => {
    expect(rewriteSrc('*.txt')).toBe('*.txt')
    expect(rewriteSrc('**/*.py')).toBe('**/*.py')
    expect(rewriteSrc('../*.txt')).toBe('*.txt')
  })
})
