/**
 * The TypeID codec: 16 bytes as 26 lowercase Crockford base32 characters.
 *
 * The 128-bit value is written in base 32, most significant digit first, with
 * the Crockford alphabet (`0-9a-z` minus `i`, `l`, `o` and `u`), left-padded
 * to 26 digits. 26 digits carry 130 bits, so the leading digit holds the top
 * three bits of the value under two bits that are always zero: every encoding
 * starts with a character from `0` to `7`.
 *
 * This is the encoding of the TypeID specification and of
 * `github.com/sumup/typeid`, which is what E2B's Go services use
 * (`packages/shared/pkg/id` in e2b-dev/infra). Agreeing with it is the whole
 * requirement: an ID minted here must decode there to the same UUID, and the
 * other way round. The Go suite's vectors are pinned in `tests/vectors.ts`.
 *
 * The digits are the bits in order and the alphabet is in ASCII order, so the
 * string sorts the way the bytes do. A UUIDv7 leads with its 48-bit millisecond
 * timestamp, and so does its ID: IDs minted together share a long prefix, and
 * lexical order is mint order to the millisecond. That is what makes a TypeID
 * k-sortable — and why the front of an ID is the least distinctive part to
 * read; look at the tail.
 *
 * Reading one in any language takes the alphabet and arithmetic:
 *
 * ```py
 * ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"
 *
 * def encode(b: bytes) -> str:
 *     n = int.from_bytes(b, "big")
 *     return "".join(ALPHABET[(n >> (5 * i)) & 31] for i in range(25, -1, -1))
 *
 * def decode(s: str) -> bytes:
 *     n = 0
 *     for c in s:
 *         n = n * 32 + ALPHABET.index(c)
 *     return n.to_bytes(16, "big")
 * ```
 *
 * Because 128 is not a multiple of 5, a leading digit of 8 or more spells a
 * value no 16 bytes can hold. A decoder that masked those bits away would map
 * four strings to every value; {@link decodeBytes} accepts only the one
 * {@link encodeBytes} produces and rejects the other three as `overflow`,
 * which is also what the Go side does.
 */

import { InvalidIdError } from './errors'

/**
 * Crockford base32, lowercased: the digits, then the letters with `i`, `l`,
 * `o` and `u` left out so nothing reads as `1` or `0`. The index of a
 * character is its digit value, and the characters are in ASCII order, which
 * is what makes encodings sort like the bytes they carry.
 */
export const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

/** The number of bytes every encoded value carries: a UUID's worth. */
export const DECODED_LENGTH = 16

/**
 * `ceil(128 / 5)`: the digits needed for 16 bytes. Every encoding is exactly
 * this wide; there is no padding to add or strip.
 */
export const ENCODED_LENGTH = 26

/**
 * `26 * 5 - 128`: the bits the width has spare. They are the two most
 * significant bits of the leading digit, and they are always zero.
 */
export const SLACK_BITS = ENCODED_LENGTH * 5 - DECODED_LENGTH * 8

/**
 * The largest digit value the leading character may hold: the three bits
 * under the slack, so `7`. Anything above it spells a 129- or 130-bit value.
 */
export const MAX_LEADING_DIGIT = (1 << (5 - SLACK_BITS)) - 1

/**
 * Character code to digit value, `-1` for anything outside the alphabet.
 *
 * A typed array rather than an object: it cannot inherit a value from
 * `Object.prototype` (`VALUES['constructor']` would not be `undefined`), and
 * `-1` rather than `undefined` means the decode loop below cannot silently OR a
 * missing digit into the buffer — `| -1` would corrupt loudly, where
 * `| undefined` corrupts as zero.
 */
const VALUES = (() => {
  const table = new Int8Array(128).fill(-1)
  for (let value = 0; value < ALPHABET.length; value++) {
    table[ALPHABET.charCodeAt(value)] = value
  }
  return table
})()

/** The digit value of a character, or `-1` if it is not in the alphabet. */
function digitAt(s: string, index: number): number {
  const code = s.charCodeAt(index)
  return code < 128 ? VALUES[code] : -1
}

/**
 * Encodes 16 bytes as 26 lowercase Crockford base32 characters, most
 * significant first.
 *
 * It cannot fail for any 16 bytes: nothing here reads a UUID's version or
 * variant, so an arbitrary 128-bit value encodes just as well as a UUID.
 *
 * @param bytes exactly 16 bytes.
 * @returns the 26-character encoding.
 * @throws {InvalidIdError} if `bytes` is not 16 bytes long.
 */
export function encodeBytes(bytes: Uint8Array): string {
  if (bytes.length !== DECODED_LENGTH) {
    throw new InvalidIdError(
      'length',
      `Cannot encode ${bytes.length} bytes: expected exactly ${DECODED_LENGTH}.`
    )
  }

  let out = ''
  let buffer = 0
  // The slack bits go in front, as zeros already in the buffer: 2 + 128 is
  // exactly 26 digits, so the loop flushes the last digit itself and nothing
  // is left over to pad.
  let bits = SLACK_BITS
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += ALPHABET[(buffer >>> bits) & 31]
    }
  }

  return out
}

/**
 * Why {@link decodeBytes} would reject a string, or `undefined` if it would
 * accept it. Reported without building an error, so {@link isId} can answer a
 * boolean without paying for a message and a stack trace.
 */
export function faultInEncoded(
  encoded: string
): { reason: 'length' | 'alphabet' | 'overflow'; index: number } | undefined {
  if (encoded.length !== ENCODED_LENGTH) {
    return { reason: 'length', index: -1 }
  }

  // Membership is checked in its own pass so the message can point at the
  // offending character. Case is part of it: uppercase is simply not in the
  // alphabet, and accepting it would give every value millions of spellings.
  for (let i = 0; i < ENCODED_LENGTH; i++) {
    if (digitAt(encoded, i) < 0) return { reason: 'alphabet', index: i }
  }

  // The slack bits are checked before decoding because the decode loop cannot
  // see them: it keeps the low 128 of the 130 bits, so all four spellings of a
  // value decode identically and the difference is only visible here.
  if (digitAt(encoded, 0) > MAX_LEADING_DIGIT) {
    return { reason: 'overflow', index: 0 }
  }

  return undefined
}

/**
 * Builds the error for a fault. Separate from {@link faultInEncoded} so that the
 * message — the expensive part — is only interpolated when something is about to
 * be thrown.
 */
export function invalidEncoding(
  encoded: string,
  fault: NonNullable<ReturnType<typeof faultInEncoded>>
): InvalidIdError {
  switch (fault.reason) {
    case 'length':
      return new InvalidIdError(
        'length',
        `"${encoded}" is ${encoded.length} characters long: expected exactly ${ENCODED_LENGTH}.`
      )
    case 'alphabet':
      return new InvalidIdError(
        'alphabet',
        `"${encoded}" holds ${JSON.stringify(encoded[fault.index])} at index ${fault.index}, which is not one of the lowercase Crockford base32 characters "${ALPHABET}".`
      )
    case 'overflow':
      return new InvalidIdError(
        'overflow',
        `"${encoded}" starts with ${JSON.stringify(encoded[fault.index])}, which spells a value above ${DECODED_LENGTH * 8} bits: the first character must be "${ALPHABET[0]}" to "${ALPHABET[MAX_LEADING_DIGIT]}".`
      )
  }
}

/**
 * Decodes what {@link encodeBytes} produced, and only that: 26 characters,
 * lowercase Crockford base32, with a leading character from `0` to `7`.
 *
 * @param encoded the 26-character encoding.
 * @returns the 16 bytes it carries.
 * @throws {InvalidIdError} if `encoded` is the wrong length, holds a character
 * outside the lowercase alphabet, or leads with a character above `7`.
 */
export function decodeBytes(encoded: string): Uint8Array {
  const fault = faultInEncoded(encoded)
  if (fault) throw invalidEncoding(encoded, fault)

  const bytes = new Uint8Array(DECODED_LENGTH)
  let buffer = 0
  // The mirror of encoding: the first two bits read are the slack, already
  // known to be zero, so the count starts below zero and the first byte is
  // complete after exactly two digits.
  let bits = -SLACK_BITS
  let i = 0
  for (let k = 0; k < ENCODED_LENGTH; k++) {
    buffer = (buffer << 5) | digitAt(encoded, k)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes[i++] = (buffer >>> bits) & 0xff
    }
  }

  return bytes
}
