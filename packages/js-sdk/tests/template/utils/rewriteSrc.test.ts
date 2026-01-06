import { expect, test, describe } from 'vitest'
import { rewriteSrc } from '../../../src/template/utils'

describe('rewriteSrc', () => {
  const contextPath = '/home/user/project'

  test('should return resolved path for parent directory paths', () => {
    expect(rewriteSrc('../file.txt', contextPath)).toBe('/home/user/file.txt')
    expect(rewriteSrc('../../config.json', contextPath)).toBe(
      '/home/config.json'
    )
    expect(rewriteSrc('../dir/file.py', contextPath)).toBe(
      '/home/user/dir/file.py'
    )
  })

  test('should preserve relative paths', () => {
    expect(rewriteSrc('file.txt', contextPath)).toBe('file.txt')
    expect(rewriteSrc('dir/file.txt', contextPath)).toBe('dir/file.txt')
    expect(rewriteSrc('./file.txt', contextPath)).toBe('./file.txt')
    expect(rewriteSrc('src/components/Button.tsx', contextPath)).toBe(
      'src/components/Button.tsx'
    )
  })

  test('should preserve absolute paths', () => {
    expect(rewriteSrc('/usr/local/file.txt', contextPath)).toBe(
      '/usr/local/file.txt'
    )
    expect(rewriteSrc('/home/user/project/file.py', contextPath)).toBe(
      '/home/user/project/file.py'
    )
  })

  test('should handle glob patterns', () => {
    expect(rewriteSrc('*.txt', contextPath)).toBe('*.txt')
    expect(rewriteSrc('**/*.py', contextPath)).toBe('**/*.py')
    expect(rewriteSrc('../*.txt', contextPath)).toBe('/home/user/*.txt')
  })
})
