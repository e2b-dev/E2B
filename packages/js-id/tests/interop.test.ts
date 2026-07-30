import { execFileSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

import { encodeBytes } from '../src/codec'
import { bytesToUuid } from '../src/uuid'
import { corpus } from './vectors'

/**
 * The interop contract, checked against another language's standard library
 * rather than against another copy of our own code.
 *
 * The snippet below is the one in `src/codec.ts`'s documentation and in
 * `@e2b/id`'s README, verbatim: six lines of `base64` and no tables. If this
 * passes, the format really is "b32encode, lowercase, strip padding, rotate",
 * so any port tested the same way against the same corpus decodes what this
 * package emits.
 */
const SNIPPET = `
import base64, sys

def encode(b: bytes) -> str:
    s = base64.b32encode(b).decode().rstrip("=").lower()
    return s[16:] + s[:16]

def decode(s: str) -> bytes:
    s = s[10:] + s[:10]
    return base64.b32decode(s.upper() + "======")

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
  "python's standard library agrees",
  () => {
    test('in both directions, over the whole corpus', () => {
      // Not a skip: on CI this suite is the only thing standing between a
      // format change and a silent fork from the other ports, so a missing
      // interpreter has to be loud.
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
