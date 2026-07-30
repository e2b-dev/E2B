/**
 * The canonical hex form of a UUID and its 16 bytes, plus a UUIDv7 mint.
 *
 * UUIDs cross this package's boundary as their canonical 36-character string
 * (`019fa519-bf79-724d-8811-a2bfda9755fa`) because that is what a database row
 * or a JSON payload holds. The bytes are the internal currency.
 */

import { DECODED_LENGTH } from './codec'
import { InvalidIdError } from './errors'

/** The canonical 8-4-4-4-12 hex form, accepted in either case. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Where the hyphens go when 32 hex digits are formatted back into a UUID. */
const GROUPS = [4, 2, 2, 2, 6]

const HEX = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, '0')
)

/**
 * Parses the canonical hex form of a UUID into its 16 bytes.
 *
 * @param uuid a UUID in 8-4-4-4-12 hex form, upper or lower case.
 * @returns the 16 bytes, most significant first.
 * @throws {InvalidIdError} if `uuid` is not in that form.
 */
export function uuidToBytes(uuid: string): Uint8Array {
  if (typeof uuid !== 'string' || !UUID_PATTERN.test(uuid)) {
    throw new InvalidIdError(
      'uuid',
      `"${uuid}" is not a UUID: expected 32 hex digits grouped 8-4-4-4-12, like "019fa519-bf79-724d-8811-a2bfda9755fa".`
    )
  }

  // `split().join()` rather than `replaceAll`, which is ES2021: the build
  // targets es2017 and rolldown lowers syntax, not library methods.
  const hex = uuid.split('-').join('')
  const bytes = new Uint8Array(DECODED_LENGTH)
  for (let i = 0; i < DECODED_LENGTH; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Formats 16 bytes as the canonical lowercase hex form of a UUID.
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

/**
 * Mints a UUIDv7: a 48-bit big-endian millisecond timestamp followed by 74
 * random bits, with the version and variant nibbles set per RFC 9562.
 *
 * IDs are minted from v7 rather than v4 so that the bytes a database stores
 * sort chronologically, even though {@link encodeId} deliberately hides that
 * order in the string it produces.
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

  const ms = Date.now()
  // Bit arithmetic tops out at 32 bits, so the 48-bit timestamp is split:
  // division for the high two bytes, shifts for the low four.
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff
  bytes[2] = (ms >>> 24) & 0xff
  bytes[3] = (ms >>> 16) & 0xff
  bytes[4] = (ms >>> 8) & 0xff
  bytes[5] = ms & 0xff

  bytes[6] = (bytes[6] & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10

  return bytesToUuid(bytes)
}
