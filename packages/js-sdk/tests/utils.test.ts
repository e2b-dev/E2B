import { expect, test, describe } from 'vitest'
import { shellQuote } from '../src/utils'

describe('shellQuote', () => {
  test('returns safe values unchanged', () => {
    expect(shellQuote('/app/data')).toBe('/app/data')
    expect(shellQuote('file-1.txt')).toBe('file-1.txt')
    expect(shellQuote('user:group')).toBe('user:group')
    expect(shellQuote('a_b@c%d+e=f,g')).toBe('a_b@c%d+e=f,g')
  })

  test('quotes the empty string', () => {
    expect(shellQuote('')).toBe("''")
  })

  test('quotes values with spaces', () => {
    expect(shellQuote('/tmp/my file')).toBe("'/tmp/my file'")
  })

  test('quotes shell metacharacters', () => {
    expect(shellQuote('a;rm -rf /')).toBe("'a;rm -rf /'")
    expect(shellQuote('$(whoami)')).toBe("'$(whoami)'")
    expect(shellQuote('a&&b')).toBe("'a&&b'")
    expect(shellQuote('a|b')).toBe("'a|b'")
  })

  test('escapes single quotes like shlex.quote', () => {
    expect(shellQuote("it's")).toBe("'it'\"'\"'s'")
  })
})
