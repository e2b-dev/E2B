/**
 * The rotated base32 codec: 16 bytes as 26 lowercase characters.
 *
 * The 16 bytes are base32-encoded with the RFC 4648 section 6 alphabet
 * ("A-Z2-7"), lowercased, unpadded: 26 characters. The string is then rotated
 * left by {@link ROTATION}, so what was the first character is now the 11th.
 *
 * Rotation is the whole trick. A UUIDv7 leads with a 48-bit big-endian
 * millisecond timestamp, so unrotated encodings of IDs minted together share a
 * long common prefix and the leading characters are nearly constant for
 * months. Rotating moves those characters inward: the string now leads with 10
 * characters of random bits, the timestamp reads out from {@link
 * TIMESTAMP_INDEX}, and its 9.6 digits are followed by the remaining random
 * bits.
 *
 * Decoding undoes it by rotating left by the other 10. The two amounts differ,
 * so unlike a half-length rotation this one is not its own inverse; rotate and
 * unrotate are separate functions and the tests hold them together.
 *
 * The alphabet is the one Python's `base64.b32encode` uses, so an
 * implementation on the other side needs no tables, only the rotation:
 *
 * ```py
 * import base64
 *
 * def encode(b: bytes) -> str:
 *     s = base64.b32encode(b).decode().rstrip("=").lower()
 *     return s[16:] + s[:16]
 *
 * def decode(s: str) -> bytes:
 *     s = s[10:] + s[:10]
 *     return base64.b32decode(s.upper() + "======")
 * ```
 *
 * 26 base32 digits carry 130 bits and 16 bytes are 128, so the final digit of
 * the unrotated string holds 2 bits that are always zero. Most base32 decoders
 * discard those bits without looking, so every value has four spellings that
 * decode to it. {@link decodeBytes} accepts only the one {@link encodeBytes}
 * produces and rejects the other three. After rotation that digit sits at
 * {@link SLACK_INDEX}, not at the end.
 */

import { InvalidIdError } from './errors'

/**
 * RFC 4648 section 6, lowercased: what Python's `base64.b32encode` produces
 * once `.lower()` is applied. The index of a character is its digit value.
 */
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

/** The number of bytes every encoded value carries: a UUID's worth. */
export const DECODED_LENGTH = 16

/**
 * `ceil(128 / 5)`: the digits needed for 16 bytes. Every encoding is exactly
 * this wide; there is no padding to add or strip.
 */
export const ENCODED_LENGTH = 26

/**
 * How far {@link encodeBytes} rotates the string left, chosen so a UUIDv7's
 * timestamp starts at {@link TIMESTAMP_INDEX}: far enough in that the leading
 * characters are random, near enough the front that the timestamp begins in the
 * first half of the string. Decoding rotates left by the remainder.
 *
 * The timestamp's ~10 digits then run from index 10 to 19, so most of it in
 * fact lands in the second half — what the rotation buys is that none of it
 * lands at the *front*, which is the part people read, sort by and truncate.
 */
export const ROTATION = 16

/**
 * Where the unrotated string's first character lands: byte 0 of the value, and
 * so bit 0 of a UUIDv7's timestamp, reads out here.
 */
export const TIMESTAMP_INDEX = ENCODED_LENGTH - ROTATION

/**
 * `26 * 5 - 128`: the always-zero bits in the final unrotated digit, and the
 * mask that selects them out of that digit's value.
 */
export const SLACK_BITS = ENCODED_LENGTH * 5 - DECODED_LENGTH * 8
export const SLACK_MASK = (1 << SLACK_BITS) - 1

/**
 * Where that digit lands after rotation: the character a decoder must check
 * for canonical form is inside the string, just before the timestamp, not at
 * the end.
 */
export const SLACK_INDEX = TIMESTAMP_INDEX - 1

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

/** Rotate a 26-character string left by {@link ROTATION}. */
function rotate(s: string): string {
  return s.slice(ROTATION) + s.slice(0, ROTATION)
}

/** Rotate left by the remainder, which undoes {@link rotate}. */
function unrotate(s: string): string {
  return (
    s.slice(ENCODED_LENGTH - ROTATION) + s.slice(0, ENCODED_LENGTH - ROTATION)
  )
}

/**
 * Encodes 16 bytes as 26 lowercase base32 characters, rotated so the leading
 * bytes read out from the middle of the string.
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
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += ALPHABET[(buffer >>> bits) & 31]
    }
  }
  // The leftover bits are shifted up into a final digit, which is where the
  // slack lives: 128 bits fill 25 digits and 3 bits of the 26th. SLACK_BITS
  // being nonzero is what guarantees there are leftovers to flush — were the
  // width ever a multiple of 40 bits this would append a spurious digit, so the
  // relationship is asserted rather than assumed.
  if (SLACK_BITS === 0) {
    throw new InvalidIdError(
      'length',
      `${DECODED_LENGTH} bytes pack evenly into base32 digits, so this codec's final-digit flush does not apply.`
    )
  }
  out += ALPHABET[(buffer << (5 - bits)) & 31]

  return rotate(out)
}

/**
 * Why {@link decodeBytes} would reject a string, or `undefined` if it would
 * accept it. Reported without building an error, so {@link isId} can answer a
 * boolean without paying for a message and a stack trace.
 */
export function faultInEncoded(
  encoded: string
): { reason: 'length' | 'alphabet' | 'canonical'; index: number } | undefined {
  if (encoded.length !== ENCODED_LENGTH) {
    return { reason: 'length', index: -1 }
  }

  // Membership is checked in its own pass so the message can point at the
  // offending character. Case is part of it: uppercase is simply not in the
  // alphabet, and accepting it would give every value millions of spellings.
  for (let i = 0; i < ENCODED_LENGTH; i++) {
    if (digitAt(encoded, i) < 0) return { reason: 'alphabet', index: i }
  }

  // The slack digit is checked before decoding because the decode loop cannot
  // see it: it drops the low bits of the final digit unread, so all four
  // spellings of a value decode identically and the difference is only visible
  // here. That digit is the last one of the unrotated string, which rotation
  // has moved to SLACK_INDEX.
  if (digitAt(encoded, SLACK_INDEX) & SLACK_MASK) {
    return { reason: 'canonical', index: SLACK_INDEX }
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
        `"${encoded}" holds ${JSON.stringify(encoded[fault.index])} at index ${fault.index}, which is not one of the lowercase base32 characters "${ALPHABET}".`
      )
    case 'canonical':
      return new InvalidIdError(
        'canonical',
        `"${encoded}" is not the canonical spelling of its value: ${JSON.stringify(encoded[fault.index])} at index ${fault.index} sets ${SLACK_BITS} bits no 128-bit value reaches.`
      )
  }
}

/**
 * Decodes what {@link encodeBytes} produced, and only that: 26 characters,
 * lowercase RFC 4648 base32, rotated, with the two slack bits zero.
 *
 * @param encoded the 26-character encoding.
 * @returns the 16 bytes it carries.
 * @throws {InvalidIdError} if `encoded` is the wrong length, holds a character
 * outside the lowercase alphabet, or is one of the three non-canonical
 * spellings of its value.
 */
export function decodeBytes(encoded: string): Uint8Array {
  const fault = faultInEncoded(encoded)
  if (fault) throw invalidEncoding(encoded, fault)

  const raw = unrotate(encoded)
  const bytes = new Uint8Array(DECODED_LENGTH)
  let buffer = 0
  let bits = 0
  let i = 0
  for (let k = 0; k < ENCODED_LENGTH; k++) {
    buffer = (buffer << 5) | digitAt(raw, k)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes[i++] = (buffer >>> bits) & 0xff
    }
  }

  return bytes
}
