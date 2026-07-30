import { describe, expect, test } from 'vitest'

import {
  ALPHABET,
  DECODED_LENGTH,
  decodeBytes,
  encodeBytes,
  ENCODED_LENGTH,
  MAX_LEADING_DIGIT,
  SLACK_BITS,
} from '../src/codec'
import { InvalidIdError } from '../src/errors'
import { bytesToUuid, uuidToBytes } from '../src/uuid'
import {
  bigintFrom,
  bytesFrom,
  corpus,
  CORPUS_DIGEST,
  corpusDigest,
  GOLDEN,
  hex,
  Lcg,
  refDecode,
  refEncode,
  SLACK_STEP,
  v7,
} from './vectors'

describe('the format', () => {
  // Pinned as literals, not as their own definitions: `expect(SLACK_BITS)
  // .toBe(ENCODED_LENGTH * 5 - DECODED_LENGTH * 8)` restates the line that
  // computes it and so can never fail. These numbers ARE the format; every ID
  // ever minted depends on them, so changing one has to break a test.
  test('the format is these exact numbers', () => {
    expect(ALPHABET).toBe('0123456789abcdefghjkmnpqrstvwxyz')
    expect(DECODED_LENGTH).toBe(16)
    expect(ENCODED_LENGTH).toBe(26)
    expect(SLACK_BITS).toBe(2)
    expect(MAX_LEADING_DIGIT).toBe(7)
  })

  // The relations that make those numbers the right ones: 25 digits cannot hold
  // 128 bits, 26 hold 130, and the slack is the difference. Unlike the pins
  // above these are derivations, so they are stated against the arithmetic.
  test('and those numbers are the ones the width forces', () => {
    expect(ENCODED_LENGTH * 5).toBeGreaterThanOrEqual(DECODED_LENGTH * 8)
    expect((ENCODED_LENGTH - 1) * 5).toBeLessThan(DECODED_LENGTH * 8)
    expect(SLACK_BITS).toBe(ENCODED_LENGTH * 5 - DECODED_LENGTH * 8)
    expect(MAX_LEADING_DIGIT).toBe((1 << (5 - SLACK_BITS)) - 1)
    expect(SLACK_STEP).toBe(MAX_LEADING_DIGIT + 1)
    expect(ALPHABET).toHaveLength(32)
    expect(new Set(ALPHABET).size).toBe(32)
    // Crockford: no i, l, o or u, so nothing reads as a 1 or a 0.
    expect(ALPHABET).not.toMatch(/[ilou]/)
    // In ASCII order, which is what lets encoded order follow byte order.
    expect([...ALPHABET].sort().join('')).toBe(ALPHABET)
  })

  test.each(GOLDEN)('%s encodes to %s', (uuid, encoded) => {
    expect(encodeBytes(uuidToBytes(uuid))).toBe(encoded)
    expect(bytesToUuid(decodeBytes(encoded))).toBe(uuid)
  })

  // The claim of the format: the string is the value's bits in 5-bit groups,
  // most significant first. Checked against refEncode, which computes it a
  // different way.
  test('the string is the bits, in order', () => {
    for (const bytes of corpus()) {
      expect(encodeBytes(bytes), hex(bytes)).toBe(refEncode(bytes))
    }
  })

  // The one constant both suites hold: same corpus, same format, same digest.
  test('the corpus is the same corpus e2b_id checks', () => {
    expect(corpusDigest(encodeBytes)).toBe(CORPUS_DIGEST)
  })

  test('every encoding round trips', () => {
    for (const bytes of corpus()) {
      const encoded = encodeBytes(bytes)
      expect(encoded, hex(bytes)).toHaveLength(ENCODED_LENGTH)
      expect(encoded).toBe(encoded.toLowerCase())
      expect(decodeBytes(encoded)).toStrictEqual(bytes)
    }
  })

  // The 31 smallest nonzero values fit in the last digit, so they are one
  // character from the encoding of zero; 32 is the first to spill into the
  // next one. That pins where the low bits live and that no shift happened.
  test.each([1, 2, 7, 8, 31])(
    'the value %i is one character from zero, at the end',
    (value) => {
      const bytes = bytesFrom(BigInt(value))
      const want = ALPHABET[0].repeat(ENCODED_LENGTH - 1) + ALPHABET[value]

      expect(encodeBytes(bytes)).toBe(want)
      expect(decodeBytes(want)).toStrictEqual(bytes)
    }
  )

  // And the top bit lands in the first digit, under the two slack bits: bit
  // 127 is the leading digit's value 4, so the largest leading digit is 7.
  test('the top bit is the leading digit', () => {
    expect(encodeBytes(bytesFrom(1n << 127n))).toBe(
      `${ALPHABET[4]}${ALPHABET[0].repeat(ENCODED_LENGTH - 1)}`
    )
    expect(encodeBytes(bytesFrom((1n << 128n) - 1n))[0]).toBe(
      ALPHABET[MAX_LEADING_DIGIT]
    )
  })
})

describe('the leading digit', () => {
  // The cost of 128 not dividing by 5. Every value has exactly four strings a
  // permissive decoder maps to it, differing only in the two high bits of the
  // leading digit. Exactly one — the one with those bits zero — is accepted.
  test('three of the four spellings of every value are rejected', () => {
    for (const bytes of corpus().slice(0, 200)) {
      const encoded = encodeBytes(bytes)
      const digit = ALPHABET.indexOf(encoded[0])
      expect(digit, encoded).toBeLessThanOrEqual(MAX_LEADING_DIGIT)

      let accepted = 0
      for (let slack = 0; slack < 1 << SLACK_BITS; slack++) {
        const alternative =
          ALPHABET[digit | (slack * SLACK_STEP)] + encoded.slice(1)

        // This is what makes the check necessary rather than incidental: a
        // decoder that keeps the low 128 bits maps all four spellings to the
        // same 16 bytes and reports nothing. Checked against refDecode, which
        // unpacks without consulting the leading digit at all.
        expect(refDecode(alternative), alternative).toStrictEqual(bytes)

        if (slack === 0) {
          expect(decodeBytes(alternative)).toStrictEqual(bytes)
          accepted++
          continue
        }
        expect(() => decodeBytes(alternative)).toThrow(InvalidIdError)
        expect(() => decodeBytes(alternative)).toThrow(/above 128 bits/)
      }
      expect(accepted, encoded).toBe(1)
    }
  })

  // The same fact from the outside: only 8 of the 32 characters can ever
  // appear first, and over enough values every one of them does.
  test('only 0 to 7 appear first', () => {
    const allowed = new Set(ALPHABET.slice(0, MAX_LEADING_DIGIT + 1))
    expect(allowed).toStrictEqual(new Set('01234567'))

    const seen = new Set<string>()
    for (const bytes of corpus()) {
      const digit = encodeBytes(bytes)[0]
      expect(allowed, `${hex(bytes)} starts with ${digit}`).toContain(digit)
      seen.add(digit)
    }
    expect(seen).toStrictEqual(allowed)
  })
})

describe('decoding rejects', () => {
  const valid = encodeBytes(uuidToBytes('019fa41f-41cc-761e-8868-daa906581007'))

  test.each([
    ['nothing at all', ''],
    ['one character short', valid.slice(0, -1)],
    ['one character long', `${valid}0`],
    ['base32 padding', `${valid.slice(0, -1)}=`],
    // Nothing here ever emits uppercase, so accepting it would give every
    // value millions of spellings. Go rejects it too.
    ['uppercase', valid.toUpperCase()],
    [
      'a single uppercase letter',
      (() => {
        // The first characters are digits, which have no upper case, so the
        // one to raise is the first letter.
        const at = valid.search(/[a-z]/)
        return (
          valid.slice(0, at) + valid[at].toUpperCase() + valid.slice(at + 1)
        )
      })(),
    ],
    // The four letters Crockford leaves out. Go's "bad alphabet" case is "i".
    ['"i", which is not in the alphabet', `${valid.slice(0, -1)}i`],
    ['"l", which is not in the alphabet', `${valid.slice(0, -1)}l`],
    ['"o", which is not in the alphabet', `${valid.slice(0, -1)}o`],
    ['"u", which is not in the alphabet', `${valid.slice(0, -1)}u`],
    ['"-", which is not a digit', `-${valid.slice(1)}`],
    ['a non-ascii character', `${valid.slice(0, -1)}é`],
    ['whitespace', ` ${valid.slice(1)}`],
    ['a leading "8"', `8${valid.slice(1)}`],
    ['a leading "z"', `z${valid.slice(1)}`],
  ])('%s', (_, encoded) => {
    expect(() => decodeBytes(encoded)).toThrow(InvalidIdError)
  })

  test('anything that is not 16 bytes', () => {
    expect(() => encodeBytes(new Uint8Array(15))).toThrow(InvalidIdError)
    expect(() => encodeBytes(new Uint8Array(17))).toThrow(InvalidIdError)
  })

  // All zeros decodes to the zero value rather than failing.
  test('but not the extremes', () => {
    expect(decodeBytes('0'.repeat(ENCODED_LENGTH))).toStrictEqual(
      new Uint8Array(16)
    )
    expect(
      decodeBytes(encodeBytes(bytesFrom((1n << 128n) - 1n)))
    ).toStrictEqual(bytesFrom((1n << 128n) - 1n))
  })
})

describe('what the encoding keeps', () => {
  // Two v7s minted in the same millisecond share their first 52 bits
  // (timestamp plus version nibble), which is their first 10 digits. The
  // encoding keeps them where they are, so the fronts match.
  test('the timestamp reads out from the front', () => {
    const source = new Lcg(7)

    for (let i = 0; i < 1000; i++) {
      const a = v7(source)
      const b = v7(source)
      b.set(a.subarray(0, 7), 0) // same millisecond, same version nibble

      expect(encodeBytes(a).slice(0, 10)).toBe(encodeBytes(b).slice(0, 10))
    }
  })

  // The same point as the user sees it: a batch minted together shares a long
  // prefix, so the tail is the part to read.
  test('ids minted together share a prefix', () => {
    const source = new Lcg(11)
    const at = 1758000000000

    const fronts = new Set<string>()
    for (let i = 0; i < 200; i++) {
      fronts.add(encodeBytes(v7(source, at + i)).slice(0, 8))
    }

    // 200 consecutive milliseconds move only the last of the first 10 digits
    // or so; the first 8 are constant over the batch.
    expect(fronts.size).toBe(1)
  })

  // What the user gets for that: encoded order is byte order, so a v7's
  // chronology survives into the string and an index on it sorts by time.
  test('and so sort order survives', () => {
    const source = new Lcg(15)
    const values = Array.from({ length: 5000 }, () => v7(source))

    for (let i = 1; i < values.length; i++) {
      let [low, high] = [values[i - 1], values[i]]
      if (bigintFrom(low) > bigintFrom(high)) [low, high] = [high, low]
      expect(encodeBytes(low) < encodeBytes(high), hex(low)).toBe(true)
    }
  })
})
