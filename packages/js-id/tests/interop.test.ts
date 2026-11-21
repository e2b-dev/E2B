import { execFileSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

import { encodeBytes } from '../src/codec'
import { bytesToUuid } from '../src/uuid'
import { corpus } from './vectors'

/**
 * The interop contract, checked against another language's arithmetic rather
 * than against another copy of our own code.
 *
 * The snippet below is the one in `src/codec.ts`'s documentation and in
 * `@e2b/id`'s README, verbatim: the alphabet and integer arithmetic, no bit
 * shuffling. If this passes, the format really is "the 128-bit value in 26
 * Crockford base32 digits, most significant first", and `e2b_id` — which is
 * tested the same way against the same corpus — decodes what this package
 * emits. `int.to_bytes(16)` raising on 129 bits is also Python's own statement
 * of the leading-digit rule.
 */
const SNIPPET = `
import sys

ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

def encode(b: bytes) -> str:
    n = int.from_bytes(b, "big")
    return "".join(ALPHABET[(n >> (5 * i)) & 31] for i in range(25, -1, -1))

def decode(s: str) -> bytes:
    n = 0
    for c in s:
        n = n * 32 + ALPHABET.index(c)
    return n.to_bytes(16, "big")

n = 0
for line in sys.stdin:
    hex_bytes, encoded = line.split()
    raw = bytes.fromhex(hex_bytes)
    assert encode(raw) == encoded, (hex_bytes, encoded, encode(raw))
    assert decode(encoded) == raw, (hex_bytes, encoded)
    n += 1
print(f"ok {n}")
`

/**
 * The interpreter to drive. Windows runners ship `python`, not `python3`, and
 * a `skipIf` keyed on `python3` alone would turn that leg into a silent no-op
 * reporting green — the one failure mode a cross-language check must not have.
 * `E2B_ID_SKIP_INTEROP=1` is the deliberate opt-out for a machine with no
 * Python at all.
 */
function findPython(): string | undefined {
  for (const candidate of ['python3', 'python']) {
    try {
      // Windows ships a `python3` App Execution Alias that exists on PATH and
      // exits nonzero, so the version has to actually run.
      const version = execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      if (version.startsWith('Python 3')) return candidate
    } catch {
      continue
    }
  }
  return undefined
}

const python = findPython()

describe.skipIf(process.env.E2B_ID_SKIP_INTEROP === '1')(
  'an independent python encoder agrees',
  () => {
    test('in both directions, over the whole corpus', () => {
      // Not a skip: on CI this suite is the only thing standing between a
      // format change and a silent fork from e2b_id, so a missing interpreter
      // has to be loud.
      expect(
        python,
        'no python3 on PATH; set E2B_ID_SKIP_INTEROP=1 to skip this suite deliberately'
      ).toBeDefined()

      const values = corpus()
      const input = values
        .map(
          (bytes) =>
            `${bytesToUuid(bytes).replaceAll('-', '')} ${encodeBytes(bytes)}`
        )
        .join('\n')

      const output = execFileSync(python!, ['-c', SNIPPET], {
        input,
        encoding: 'utf8',
      })

      expect(output.trim()).toBe(`ok ${values.length}`)
    })
  }
)
