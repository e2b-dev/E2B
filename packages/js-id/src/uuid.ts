/**
 * The hex form of a UUID and its 16 bytes, plus a UUIDv7 mint — both mirroring
 * `github.com/google/uuid`, which is what E2B's Go services parse and mint
 * UUIDs with, so that a UUID string Go accepts is one this package accepts, and
 * the UUIDs minted here have the shape of the ones minted there.
 *
 * UUIDs cross this package's boundary as strings
 * (`019fa519-bf79-724d-8811-a2bfda9755fa`) because that is what a database row
 * or a JSON payload holds. The bytes are the internal currency.
 */

import { DECODED_LENGTH } from './codec'
import { InvalidIdError } from './errors'

/** The hyphenated 8-4-4-4-12 form, in either case. */
const HYPHENATED =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 32 bare hex digits, in either case. */
const BARE = /^[0-9a-f]{32}$/i

/** The prefix of the URN form, matched case-insensitively like Go does. */
const URN_PREFIX = 'urn:uuid:'

/** Where the hyphens go when 32 hex digits are formatted back into a UUID. */
const GROUPS = [4, 2, 2, 2, 6]

const HEX = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, '0')
)

/**
 * The 32 hex digits of a UUID string, or `undefined` if it is not one.
 *
 * Exactly the four spellings `google/uuid`'s `Parse` takes, chosen by length
 * as it does: hyphenated, `urn:uuid:`-prefixed, braced, and bare. Nothing is
 * checked about the version or variant bits, as nothing is there — a value
 * that is 128 bits but not an RFC 9562 UUID still parses, and encodes.
 *
 * Go does not look at the braces themselves: it drops the first character and
 * never reads the last, so `[…]` and `x…y` parse there. That is an oversight
 * rather than a contract, and it is not mirrored — the braces have to be
 * braces here.
 */
function hexDigitsOf(uuid: string): string | undefined {
  switch (uuid.length) {
    case 36:
      return HYPHENATED.test(uuid) ? uuid.split('-').join('') : undefined
    case 36 + URN_PREFIX.length:
      return uuid.slice(0, URN_PREFIX.length).toLowerCase() === URN_PREFIX
        ? hexDigitsOf(uuid.slice(URN_PREFIX.length))
        : undefined
    case 36 + 2:
      return uuid[0] === '{' && uuid[37] === '}'
        ? hexDigitsOf(uuid.slice(1, -1))
        : undefined
    case 32:
      return BARE.test(uuid) ? uuid : undefined
    default:
      return undefined
  }
}

/**
 * Parses a UUID string into its 16 bytes.
 *
 * @param uuid a UUID in any of the four forms `google/uuid` accepts: hyphenated
 * 8-4-4-4-12, the same with a `urn:uuid:` prefix or in braces, or 32 bare hex
 * digits; upper or lower case.
 * @returns the 16 bytes, most significant first.
 * @throws {InvalidIdError} if `uuid` is not in one of those forms.
 */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = typeof uuid === 'string' ? hexDigitsOf(uuid) : undefined
  if (hex === undefined) {
    throw new InvalidIdError(
      'uuid',
      `"${uuid}" is not a UUID: expected 32 hex digits, hyphenated 8-4-4-4-12 like "019fa519-bf79-724d-8811-a2bfda9755fa" (optionally in braces or after "urn:uuid:"), or unhyphenated.`
    )
  }

  const bytes = new Uint8Array(DECODED_LENGTH)
  for (let i = 0; i < DECODED_LENGTH; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Formats 16 bytes as the canonical lowercase hex form of a UUID: the one
 * `google/uuid`'s `String` produces, and the one this package always returns.
 *
 * @param bytes exactly 16 bytes, most significant first.
 * @returns the UUID in 8-4-4-4-12 hex form.
 * @throws {InvalidIdError} if `bytes` is not 16 bytes long.
 */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== DECODED_LENGTH) {
    throw new InvalidIdError(
      'uuid',
      `Cannot format ${bytes.length} bytes as a UUID: expected exactly ${DECODED_LENGTH}.`
    )
  }

  let uuid = ''
  let offset = 0
  for (const group of GROUPS) {
    if (offset > 0) uuid += '-'
    for (let i = 0; i < group; i++) uuid += HEX[bytes[offset + i]]
    offset += group
  }
  return uuid
}

/** The width of the sequence field: the 12 bits of `rand_a`. */
const SEQUENCE_BITS = 12
const SEQUENCE_MAX = (1 << SEQUENCE_BITS) - 1

/**
 * The last timestamp and sequence handed out, so the next pair is always
 * greater: `google/uuid` keeps the same two numbers behind a mutex. Module
 * state, so it is per process, like Go's.
 */
let lastMs = -1
let lastSequence = 0

/**
 * The timestamp and sequence for the next UUIDv7, strictly greater than the
 * previous pair even if the clock stalls or steps back.
 *
 * `google/uuid` fills the sequence from the sub-millisecond part of the clock
 * (nanoseconds divided by 256) and only bumps when that fails to move. The
 * platform clock here is `Date.now`, whole milliseconds, so the sequence is
 * all bump: it counts up through a millisecond and carries into the next when
 * it overflows, which is also what Go does once its clock reading is behind.
 * Same shape, same guarantee; only the cross-process tie-break Go's
 * sub-millisecond bits give is missing.
 */
function nextV7Time(): [ms: number, sequence: number] {
  let ms = Date.now()
  let sequence = 0
  if (ms < lastMs || (ms === lastMs && sequence <= lastSequence)) {
    ms = lastMs
    sequence = lastSequence + 1
    if (sequence > SEQUENCE_MAX) {
      ms += 1
      sequence = 0
    }
  }
  lastMs = ms
  lastSequence = sequence
  return [ms, sequence]
}

/**
 * Mints a UUIDv7 the way `google/uuid`'s `NewV7` does: a 48-bit big-endian
 * millisecond timestamp, the version nibble, a 12-bit sequence that makes
 * every UUID minted by this process strictly greater than the one before, the
 * variant bits, and 62 random bits.
 *
 * IDs are minted from v7 rather than v4 so that the bytes a database stores
 * sort chronologically — and, since {@link encodeId} keeps the bits in order,
 * so do the IDs, down to the order of two calls in the same millisecond. The
 * Go side mints project and workspace UUIDs as v4; the codec does not care
 * either way.
 *
 * @returns the UUID in canonical hex form.
 * @example
 * ```ts
 * const uuid = createUuid() // '019fa519-bf79-724d-8811-a2bfda9755fa'
 * ```
 */
export function createUuid(): string {
  const bytes = new Uint8Array(DECODED_LENGTH)
  crypto.getRandomValues(bytes)

  const [ms, sequence] = nextV7Time()
  // Bit arithmetic tops out at 32 bits, so the 48-bit timestamp is split:
  // division for the high two bytes, shifts for the low four.
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff
  bytes[2] = (ms >>> 24) & 0xff
  bytes[3] = (ms >>> 16) & 0xff
  bytes[4] = (ms >>> 8) & 0xff
  bytes[5] = ms & 0xff

  bytes[6] = 0x70 | ((sequence >>> 8) & 0x0f) // version 7, sequence high
  bytes[7] = sequence & 0xff // sequence low
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10

  return bytesToUuid(bytes)
}
