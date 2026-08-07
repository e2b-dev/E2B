import { describe, expect, test } from 'vitest'

import {
  ALPHABET,
  DECODED_LENGTH,
  decodeBytes,
  encodeBytes,
  ENCODED_LENGTH,
  ROTATION,
  SLACK_BITS,
  SLACK_INDEX,
  SLACK_MASK,
  TIMESTAMP_INDEX,
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
  v7,
} from './vectors'

describe('the format', () => {
  // Pinned as literals, not as their own definitions: `expect(TIMESTAMP_INDEX)
  // .toBe(ENCODED_LENGTH - ROTATION)` restates the line that computes it and so
  // can never fail — it would stay green with ROTATION changed to 20, which is a
  // different wire format. These numbers ARE the format; every ID ever minted
  // depends on them, so changing one has to break a test.
  test('the format is these exact numbers', () => {
    expect(ALPHABET).toBe('abcdefghijklmnopqrstuvwxyz234567')
    expect(DECODED_LENGTH).toBe(16)
    expect(ENCODED_LENGTH).toBe(26)
    expect(ROTATION).toBe(16)
    expect(TIMESTAMP_INDEX).toBe(10)
    expect(SLACK_INDEX).toBe(9)
    expect(SLACK_BITS).toBe(2)
    expect(SLACK_MASK).toBe(3)
  })

  // The relations that make those numbers the right ones: 25 digits cannot hold
  // 128 bits, 26 hold 130, and the slack is the difference. Unlike the pins
  // above these are derivations, so they are stated against the arithmetic.
  test('and those numbers are the ones the width forces', () => {
    expect(ENCODED_LENGTH * 5).toBeGreaterThanOrEqual(DECODED_LENGTH * 8)
    expect((ENCODED_LENGTH - 1) * 5).toBeLessThan(DECODED_LENGTH * 8)
    expect(SLACK_BITS).toBe(ENCODED_LENGTH * 5 - DECODED_LENGTH * 8)
    expect(SLACK_MASK).toBe((1 << SLACK_BITS) - 1)
    expect(TIMESTAMP_INDEX).toBe(ENCODED_LENGTH - ROTATION)
    expect(SLACK_INDEX).toBe(TIMESTAMP_INDEX - 1)
    expect(ALPHABET).toHaveLength(32)
    expect(new Set(ALPHABET).size).toBe(32)
    // The front must be random, which needs the rotation past a v7's 10
    // non-random leading digits (48 timestamp bits plus 2 of the version nibble).
    expect(ROTATION).toBeGreaterThanOrEqual(14)
    expect(ROTATION).toBeLessThan(ENCODED_LENGTH) // not a full turn
  })

  test.each(GOLDEN)('%s encodes to %s', (uuid, encoded) => {
    expect(encodeBytes(uuidToBytes(uuid))).toBe(encoded)
    expect(bytesToUuid(decodeBytes(encoded))).toBe(uuid)
  })

  // The claim of the format: the string is the value's bits in 5-bit groups,
  // rotated. Checked against refEncode, which computes it a different way.
  test('the string is the bits, rotated', () => {
    for (const bytes of corpus()) {
      expect(encodeBytes(bytes), hex(bytes)).toBe(refEncode(bytes))
    }
  })

  // The one constant every port holds: same corpus, same format, same digest.
  test('the corpus digest is the cross-implementation contract', () => {
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

  // The seven smallest nonzero values fit entirely in the slack digit:
  // encoding shifts a value up by the two slack bits, so 1 through 7 become
  // digit values 4 through 28, always a multiple of 4 and so always canonical.
  // Seven strings differing from the encoding of zero in exactly one character
  // say where the low bits live, that the shift happened, and where the
  // rotation put it. Value 8 is the first to spill into a second digit.
  test.each([1, 2, 3, 4, 5, 6, 7])(
    'the value %i is one character from zero',
    (value) => {
      const bytes = bytesFrom(BigInt(value))
      const want =
        'a'.repeat(SLACK_INDEX) +
        ALPHABET[value << SLACK_BITS] +
        'a'.repeat(ENCODED_LENGTH - SLACK_INDEX - 1)

      expect(encodeBytes(bytes)).toBe(want)
      expect(decodeBytes(want)).toStrictEqual(bytes)
    }
  )
})

describe('canonical form', () => {
  // The cost of 128 not dividing by 5. Every value has exactly four strings a
  // permissive base32 decoder maps to it, differing only in the slack digit,
  // which rotation has moved to SLACK_INDEX. Exactly one is canonical.
  test('three of the four spellings of every value are rejected', () => {
    for (const bytes of corpus().slice(0, 200)) {
      const encoded = encodeBytes(bytes)
      const digit = ALPHABET.indexOf(encoded[SLACK_INDEX])
      expect(digit & SLACK_MASK, encoded).toBe(0)

      let accepted = 0
      for (let slack = 0; slack <= SLACK_MASK; slack++) {
        const alternative =
          encoded.slice(0, SLACK_INDEX) +
          ALPHABET[digit | slack] +
          encoded.slice(SLACK_INDEX + 1)

        // This is what makes the canonical check necessary rather than
        // incidental: a permissive decoder — including the six-line b32decode
        // snippet this package advertises — maps all four spellings to the same
        // 16 bytes and reports nothing. Checked against refDecode, which
        // unrotates and unpacks without consulting the slack digit at all.
        expect(refDecode(alternative), alternative).toStrictEqual(bytes)

        if (slack === 0) {
          expect(decodeBytes(alternative)).toStrictEqual(bytes)
          accepted++
          continue
        }
        expect(() => decodeBytes(alternative)).toThrow(InvalidIdError)
        expect(() => decodeBytes(alternative)).toThrow(/canonical/)
      }
      expect(accepted, encoded).toBe(1)
    }
  })

  // The same fact from the outside: only 8 of the 32 characters can ever
  // appear at SLACK_INDEX, and over enough values every one of them does.
  test('only multiples of four appear in the slack digit', () => {
    const allowed = new Set(
      Array.from(
        { length: 32 / (SLACK_MASK + 1) },
        (_, i) => ALPHABET[i * (SLACK_MASK + 1)]
      )
    )

    const seen = new Set<string>()
    for (const bytes of corpus()) {
      const digit = encodeBytes(bytes)[SLACK_INDEX]
      expect(
        allowed,
        `${hex(bytes)} has ${digit} at index ${SLACK_INDEX}`
      ).toContain(digit)
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
    ['one character long', `${valid}a`],
    ['base32 padding', `${valid.slice(0, -1)}=`],
    // Nothing here ever emits uppercase, so accepting it would give every
    // value millions of spellings.
    ['uppercase', valid.toUpperCase()],
    [
      'a single uppercase letter',
      (() => {
        // The first character may be a digit, which has no upper case, so the
        // one to raise is the first letter.
        const at = valid.search(/[a-z]/)
        return (
          valid.slice(0, at) + valid[at].toUpperCase() + valid.slice(at + 1)
        )
      })(),
    ],
    ['"0", which is not in the alphabet', `0${valid.slice(1)}`],
    ['"1", which is not in the alphabet', `1${valid.slice(1)}`],
    ['"8", which is not in the alphabet', `8${valid.slice(1)}`],
    ['"9", which is not in the alphabet', `9${valid.slice(1)}`],
    ['"-", which is not a digit', `-${valid.slice(1)}`],
    ['a non-ascii character', `${valid.slice(0, -1)}é`],
    ['whitespace', ` ${valid.slice(1)}`],
  ])('%s', (_, encoded) => {
    expect(() => decodeBytes(encoded)).toThrow(InvalidIdError)
  })

  test('anything that is not 16 bytes', () => {
    expect(() => encodeBytes(new Uint8Array(15))).toThrow(InvalidIdError)
    expect(() => encodeBytes(new Uint8Array(17))).toThrow(InvalidIdError)
  })

  // All zeros decodes to the zero value rather than failing.
  test('but not the extremes', () => {
    expect(decodeBytes('a'.repeat(ENCODED_LENGTH))).toStrictEqual(
      new Uint8Array(16)
    )
    expect(
      decodeBytes(encodeBytes(bytesFrom((1n << 128n) - 1n)))
    ).toStrictEqual(bytesFrom((1n << 128n) - 1n))
  })
})

describe('what the rotation buys', () => {
  // Two v7s minted in the same millisecond share their first 52 bits
  // (timestamp plus version nibble), which is their first 10 digits; rotation
  // moves those to indices 10 through 19. So the insides must match and, over
  // enough samples, the fronts must not.
  test('the timestamp reads out from the middle, the front stays random', () => {
    const source = new Lcg(7)

    let sameFront = 0
    for (let i = 0; i < 1000; i++) {
      const a = v7(source)
      const b = v7(source)
      b.set(a.subarray(0, 7), 0) // same millisecond, same version nibble

      const [encodedA, encodedB] = [encodeBytes(a), encodeBytes(b)]
      expect(encodedA.slice(TIMESTAMP_INDEX, TIMESTAMP_INDEX + 10)).toBe(
        encodedB.slice(TIMESTAMP_INDEX, TIMESTAMP_INDEX + 10)
      )
      if (encodedA.slice(0, 4) === encodedB.slice(0, 4)) sameFront++
    }

    // The first 4 characters are 20 random bits; collisions are ~1e-6.
    expect(sameFront).toBeLessThanOrEqual(2)
  })

  // The same point as the user sees it: a batch minted together would have
  // shared a long prefix unrotated, and must not now.
  test('ids minted together do not share a prefix', () => {
    const source = new Lcg(11)
    const at = 1758000000000

    const fronts = new Set<string>()
    for (let i = 0; i < 200; i++) fronts.add(encodeBytes(v7(source, at + i))[0])

    // 200 draws over 32 first characters: fewer than 10 distinct would be
    // wildly improbable for uniform bits.
    expect(fronts.size).toBeGreaterThanOrEqual(10)
  })

  // The trade, stated plainly so no one builds an index on these strings
  // expecting v7's chronology to survive: the front is random, so encoded
  // order and timestamp order are unrelated.
  test('and what it costs: sort order is gone', () => {
    const source = new Lcg(15)
    const values = Array.from({ length: 5000 }, () => v7(source))

    let inversions = 0
    for (let i = 1; i < values.length; i++) {
      let [low, high] = [values[i - 1], values[i]]
      if (bigintFrom(low) > bigintFrom(high)) [low, high] = [high, low]
      if (encodeBytes(low) > encodeBytes(high)) inversions++
    }

    // Random fronts mean about half of all pairs invert.
    expect(inversions).toBeGreaterThan(values.length / 5)
  })
})
