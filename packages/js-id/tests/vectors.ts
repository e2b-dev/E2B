/**
 * The shared test material: golden encodings, and a deterministic corpus.
 *
 * `packages/python-id/tests/vectors.py` is the same file in Python, value for
 * value — the same goldens, the same LCG, the same corpus in the same order.
 * That is what keeps the two implementations from drifting: both check the same
 * inputs against the same fixed outputs and against their own independent
 * reference encoder, so agreeing with this file means agreeing with each other.
 */

import { createHash } from 'node:crypto'

import { ALPHABET, ENCODED_LENGTH, ROTATION, SLACK_BITS } from '../src/codec'
import type { IdKind } from '../src/id'

/**
 * UUIDs and the encodings they must produce. These strings were computed with
 * Python's `base64.b32encode` rather than captured from this package, so they
 * check the implementation rather than record it, and they are the
 * compatibility contract: change the alphabet, the width or the rotation and
 * they stop matching.
 *
 * The five v7s were minted 37ms apart, so note what the rotation did: they
 * share "agp2kg" from index 10, which is the common timestamp showing through,
 * and their fronts differ.
 */
export const GOLDEN: ReadonlyArray<readonly [uuid: string, encoded: string]> = [
  // v7, minted 37ms apart.
  ['019fa519-bf79-724d-8811-a2bfda9755fa', 'uk75vf2v7iagp2kgn7pfze3car'],
  ['019fa519-bf9f-762a-a916-431479cc7171', 'imkhttdroeagp2kgn7t53cvkiw'],
  ['019fa519-bfc5-784d-9386-a5d7a93a692a', 'uxl2sotjfiagp2kgn7yv4e3e4g'],
  ['019fa519-bfeb-79f2-aa2a-0addf5b9c0d9', 'blo7looa3eagp2kgn75n47fkrk'],
  ['019fa519-c011-7c8e-a039-cb3ba8ca8c16', 'zm52rsumcyagp2kgoacf6i5ibz'],
  // v3 and v5 of "e2b.dev" in the DNS namespace: the only versions that are
  // deterministic, and so the only ones that can be pinned by name.
  ['a3692b74-8ded-3329-af53-cc23b4d7dc27', 'zqr3jv64e4unusw5en5uzstl2t'],
  ['fbe1337a-dac0-53d8-805c-905bca106f3e', 'sbn4uedphy7pqtg6w2ybj5rac4'],
  // A real v4.
  ['f47ac10b-58cc-4372-a567-0e02b2c3d479', 'byblfq6upe6r5mcc2yzrbxfjlh'],
  // The extremes, and the value whose only set bit is the lowest one: it
  // lands in the slack digit, which rotation has moved to index 9.
  ['00000000-0000-0000-0000-000000000000', 'aaaaaaaaaaaaaaaaaaaaaaaaaa'],
  ['00000000-0000-0000-0000-000000000001', 'aaaaaaaaaeaaaaaaaaaaaaaaaa'],
  ['ffffffff-ffff-ffff-ffff-ffffffffffff', '77777777747777777777777777'],
  // Not UUIDs at all: two IPv6 addresses, which are the same 16 bytes and so
  // encode in the same column. Nothing in the codec reads version bits, and
  // these have none to read.
  ['26064700-4700-0000-0000-000000001111', 'aaaaaaarceeydeoachaaaaaaaa'], // 2606:4700:4700::1111
  ['20010db8-85a3-0000-0000-8a2e03707334', 'rixag4dtgqeaaq3oefumaaaaaa'], // 2001:db8:85a3::8a2e:370:7334
]

/** The same contract for the prefixed form, one per kind. */
export const GOLDEN_IDS: ReadonlyArray<
  readonly [kind: IdKind, uuid: string, id: string]
> = [
  [
    'project',
    '019fa519-bf79-724d-8811-a2bfda9755fa',
    'prj_uk75vf2v7iagp2kgn7pfze3car',
  ],
  [
    'workspace',
    '019fa519-bf9f-762a-a916-431479cc7171',
    'wrk_imkhttdroeagp2kgn7t53cvkiw',
  ],
  [
    'volume',
    '019fa519-bfc5-784d-9386-a5d7a93a692a',
    'vol_uxl2sotjfiagp2kgn7yv4e3e4g',
  ],
  [
    'sandbox',
    '019fa519-bfeb-79f2-aa2a-0addf5b9c0d9',
    'sbx_blo7looa3eagp2kgn75n47fkrk',
  ],
  [
    'user',
    '019fa519-c011-7c8e-a039-cb3ba8ca8c16',
    'usr_zm52rsumcyagp2kgoacf6i5ibz',
  ],
  [
    'group',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'grp_byblfq6upe6r5mcc2yzrbxfjlh',
  ],
]

/**
 * sha256 of every encoding in {@link corpus}, newline-joined, in order. The same
 * constant appears in `vectors.py`; if the two implementations ever disagree
 * about the corpus or the format, one of them fails on it.
 */
export const CORPUS_DIGEST =
  'a83c455e0a4ffd39e51c69d832c544b6809bf836f6459e2a9797005dddc71ec0'

const MASK_64 = (1n << 64n) - 1n
const MASK_128 = (1n << 128n) - 1n

/**
 * A 64-bit linear congruential generator, so that the random half of the
 * corpus is reproducible and identical in every implementation. The
 * multiplier and increment are PCG's; the output byte is the top one, since
 * an LCG's low bits are the weak ones.
 */
export class Lcg {
  private state: bigint

  constructor(seed: number) {
    this.state = BigInt(seed) & MASK_64
  }

  byte(): number {
    this.state =
      (this.state * 6364136223846793005n + 1442695040888963407n) & MASK_64
    return Number((this.state >> 56n) & 0xffn)
  }

  bytes(count: number): Uint8Array {
    return Uint8Array.from({ length: count }, () => this.byte())
  }
}

/** 16 bytes with a v4's version and variant nibbles. */
function v4(lcg: Lcg): Uint8Array {
  const bytes = lcg.bytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytes
}

/**
 * 16 bytes shaped like a v7: a 48-bit millisecond timestamp somewhere between
 * 2020 and 2089, then the version and variant nibbles.
 */
export function v7(source: Lcg, ms?: number): Uint8Array {
  // Exactly 16 bytes are drawn either way, so the corpus does not shift when a
  // caller pins the timestamp.
  const bytes = source.bytes(16)
  const at = BigInt(
    ms ?? 1577836800000 + Number(bigintFrom(bytes.subarray(0, 6)) % (1n << 41n))
  )
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((at >> BigInt(8 * (5 - i))) & 0xffn)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return bytes
}

export function bigintFrom(bytes: Uint8Array): bigint {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)
  return value
}

export function bytesFrom(value: bigint): Uint8Array {
  const bytes = new Uint8Array(16)
  let rest = value & MASK_128
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(rest & 0xffn)
    rest >>= 8n
  }
  return bytes
}

/**
 * The shared input: the extremes, the smallest values, every power of two
 * either side — a digit boundary falls every 5 bits and that is where a
 * packing mistake shows — the goldens, and a reproducible random tail of v4s,
 * v7s and values that are neither.
 */
export function corpus(): Uint8Array[] {
  const values: Uint8Array[] = [bytesFrom(0n), bytesFrom(MASK_128)]

  for (let value = 1n; value <= 7n; value++) values.push(bytesFrom(value))

  for (let bit = 1n; bit < 128n; bit++) {
    const power = 1n << bit
    for (const delta of [-1n, 0n, 1n]) values.push(bytesFrom(power + delta))
  }

  for (const [uuid] of GOLDEN) {
    values.push(bytesFrom(BigInt(`0x${uuid.replaceAll('-', '')}`)))
  }

  const random = new Lcg(1)
  for (let i = 0; i < 300; i++) {
    values.push(v4(random), v7(random), random.bytes(16))
  }

  return values
}

/**
 * An independent implementation of the format, stated as arithmetic rather
 * than as bit shuffling: the 128-bit value, moved up by the two slack bits,
 * written in 26 base32 digits, then rotated. `encodeBytes` is checked against
 * this rather than against itself.
 */
export function refEncode(bytes: Uint8Array): string {
  let value = bigintFrom(bytes) << BigInt(SLACK_BITS)

  const digits: string[] = []
  for (let i = 0; i < ENCODED_LENGTH; i++) {
    digits.unshift(ALPHABET[Number(value & 31n)])
    value >>= 5n
  }

  const raw = digits.join('')
  return raw.slice(ROTATION) + raw.slice(0, ROTATION)
}

/**
 * The permissive counterpart to {@link refEncode}: unrotate, unpack 26 digits
 * into 130 bits, keep the top 128. It does not look at the slack digit, which is
 * the point — it is what a third-party decoder built from the README snippet
 * does, so the tests can show that all four spellings of a value reach it.
 */
export function refDecode(encoded: string): Uint8Array {
  const raw =
    encoded.slice(ENCODED_LENGTH - ROTATION) +
    encoded.slice(0, ENCODED_LENGTH - ROTATION)

  let value = 0n
  for (const character of raw) {
    value = (value << 5n) | BigInt(ALPHABET.indexOf(character))
  }
  return bytesFrom(value >> BigInt(SLACK_BITS))
}

/** The digest {@link CORPUS_DIGEST} pins. */
export function corpusDigest(encode: (bytes: Uint8Array) => string): string {
  return createHash('sha256')
    .update(corpus().map(encode).join('\n'))
    .digest('hex')
}

/** 32 hex digits, for naming the offending value in a failure message. */
export function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}
