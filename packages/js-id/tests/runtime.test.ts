import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')

/**
 * The package runs anywhere: browsers, Cloudflare Workers, Deno, Bun and Node,
 * with no compatibility flags. That holds only as long as `src` reaches for
 * nothing but platform globals — `crypto.getRandomValues` and `Date.now`.
 *
 * A single `node:*` import anywhere in the graph is enough to break it, and it
 * breaks at import time rather than at the call, so tree-shaking does not save
 * you (see js-sdk and e2b-dev/e2b#1579, where an eager `createRequire` shim
 * crashed workerd on import). This test is cheaper than finding out again.
 */
test('the source reaches for no runtime-specific api', () => {
  const offenders: string[] = []

  // Recursive: a `src/internal/*.ts` added later is just as fatal, and a
  // non-recursive scan would skip the subdirectory without a word.
  const files = readdirSync(SRC, { recursive: true }) as string[]
  expect(files.length).toBeGreaterThan(0)

  for (const file of files) {
    if (!file.endsWith('.ts')) continue
    const source = readFileSync(join(SRC, file), 'utf8')

    // Comments carry `node:` in prose and `require` in explanations, so only
    // real code counts: strip block comments and line comments first.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    for (const pattern of [
      /\bfrom\s+['"]node:/,
      /\brequire\s*\(/,
      /\bprocess\./,
      /\bBuffer\b/,
      /\b__dirname\b/,
    ]) {
      const match = code.match(pattern)
      if (match) offenders.push(`${file}: ${match[0]}`)
    }
  }

  expect(offenders).toStrictEqual([])
})
