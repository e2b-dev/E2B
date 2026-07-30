/**
 * The shared test material: golden encodings, and a deterministic corpus.
 *
 * Every port of this format carries this file value for value — the same
 * goldens, the same LCG, the same corpus in the same order. That is what keeps
 * implementations from drifting: each checks the same inputs against the same
 * fixed outputs and against its own independent reference encoder, so agreeing
 * with this file means agreeing with each other.
 */

import { createHash } from 'node:crypto'

import { ALPHABET, ENCODED_LENGTH, SLACK_BITS } from '../src/codec'
import type { IdKind } from '../src/id'

/**
 * UUIDs and the encodings they must produce. The first four are copied from
 * the Go suite (`packages/shared/pkg/id/object_test.go` in e2b-dev/infra), so
 * they are the compatibility contract with the services rather than a record
 * of this package; the rest were computed with the arithmetic snippet in
 * `src/codec.ts`. Change the alphabet, the width or the bit order and they stop
 * matching.
 *
 * The five v7s were minted 37ms apart, so note what the encoding keeps: they
 * share "01kyjhkf" at the front, which is the common timestamp showing
 * through, and differ from there.
 */
export const GOLDEN: ReadonlyArray<readonly [uuid: string, encoded: string]> = [
  // From the Go suite: a v4, the team UUID, a v7 secret, and the "legacy body"
  // test — a string in the old rotated format that happens to be a well-formed
  // TypeID too, which Go pins as reading to this UUID and nothing else.
  ['f47ac10b-58cc-4372-a567-0e02b2c3d479', '7mfb0gpp6c8dsaasre0asc7n3s'],
  ['550e8400-e29b-41d4-a716-446655440000', '2n1t201rmv87aae5j4csam8000'],
  ['019fa519-bf79-724d-8811-a2bfda9755fa', '01kyjhkfvse96rg4d2qzd9enft'],
  ['df8aa05e-b25e-7932-a6aa-33a2cddc3eef', '6zhag5xcjyf4sadahkmb6xrfqf'],
  // v7, minted 37ms after the one above and after each other.
  ['019fa519-bf9f-762a-a916-431479cc7171', '01kyjhkfwzernaj5j32hwwrwbh'],
  ['019fa519-bfc5-784d-9386-a5d7a93a692a', '01kyjhkfy5f16s71n5tymkmt9a'],
  ['019fa519-bfeb-79f2-aa2a-0addf5b9c0d9', '01kyjhkfzbf7samagavqtvkg6s'],
  ['019fa519-c011-7c8e-a039-cb3ba8ca8c16', '01kyjhkg0hfj7a0eeb7emcn30p'],
  // v3 and v5 of "e2b.dev" in the DNS namespace: the only versions that are
  // deterministic, and so the only ones that can be pinned by name.
  ['a3692b74-8ded-3329-af53-cc23b4d7dc27', '53d4nq93fd6cmtymyc4etdfq17'],
  ['fbe1337a-dac0-53d8-805c-905bca106f3e', '7vw4sqnpp0afc80q4gbf510vsy'],
  // The extremes: the leading digit tops out at 7 because it holds only three
  // bits of the value, and the lowest bit lands in the last character.
  ['00000000-0000-0000-0000-000000000000', '00000000000000000000000000'],
  ['00000000-0000-0000-0000-000000000001', '00000000000000000000000001'],
  ['80000000-0000-0000-0000-000000000000', '40000000000000000000000000'],
  ['ffffffff-ffff-ffff-ffff-ffffffffffff', '7zzzzzzzzzzzzzzzzzzzzzzzzz'],
  // Not UUIDs at all: two IPv6 addresses, which are the same 16 bytes and so
  // encode in the same column. Nothing in the codec reads version bits, and
  // these have none to read.
  ['26064700-4700-0000-0000-000000001111', '160s3g0hr0000000000000048h'], // 2606:4700:4700::1111
  ['20010db8-85a3-0000-0000-8a2e03707334', '10046vh1d30000004a5r1q0wsm'], // 2001:db8:85a3::8a2e:370:7334
]

/**
 * The same contract for the prefixed form, one per kind. The project,
 * workspace and secret IDs are the Go suite's own, prefix and all.
 */
export const GOLDEN_IDS: ReadonlyArray<
  readonly [kind: IdKind, uuid: string, id: string]
> = [
  [
    'project',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'prj_7mfb0gpp6c8dsaasre0asc7n3s',
  ],
  [
    'workspace',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'wrk_7mfb0gpp6c8dsaasre0asc7n3s',
  ],
  [
    'secret',
    '019fa519-bf79-724d-8811-a2bfda9755fa',
    'sec_01kyjhkfvse96rg4d2qzd9enft',
  ],
  [
    'volume',
    '019fa519-bfc5-784d-9386-a5d7a93a692a',
    'vol_01kyjhkfy5f16s71n5tymkmt9a',
  ],
  [
    'sandbox',
    '019fa519-bfeb-79f2-aa2a-0addf5b9c0d9',
    'sbx_01kyjhkfzbf7samagavqtvkg6s',
  ],
  [
    'user',
    '019fa519-c011-7c8e-a039-cb3ba8ca8c16',
    'usr_01kyjhkg0hfj7a0eeb7emcn30p',
  ],
  [
    'group',
    '550e8400-e29b-41d4-a716-446655440000',
    'grp_2n1t201rmv87aae5j4csam8000',
  ],
]

/**
 * sha256 of every encoding in {@link corpus}, newline-joined, in order. The same
 * constant is pinned by every port; if two implementations ever disagree about
 * the corpus or the format, one of them fails on it.
 */
export const CORPUS_DIGEST =
  'e58522dfc30f44687edca477cc58f37015d7c9e1c46311a354654db07b2f6bdc'

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
 * than as bit shuffling: the 128-bit value written in 26 base32 digits, most
 * significant first. `encodeBytes` is checked against this rather than against
 * itself.
 */
export function refEncode(bytes: Uint8Array): string {
  let value = bigintFrom(bytes)

  const digits: string[] = []
  for (let i = 0; i < ENCODED_LENGTH; i++) {
    digits.unshift(ALPHABET[Number(value & 31n)])
    value >>= 5n
  }

  return digits.join('')
}

/**
 * The permissive counterpart to {@link refEncode}: unpack 26 digits into 130
 * bits and keep the low 128. It does not look at the slack bits, which is the
 * point — it is what a decoder that forgets the leading-digit rule does, so the
 * tests can show that all four spellings of a value reach it.
 */
export function refDecode(encoded: string): Uint8Array {
  let value = 0n
  for (const character of encoded) {
    value = (value << 5n) | BigInt(ALPHABET.indexOf(character))
  }
  return bytesFrom(value & MASK_128)
}

/**
 * The slack bits, as they sit in the leading digit: the high {@link SLACK_BITS}
 * of its five. OR-ing any nonzero multiple of this into the first digit's value
 * gives one of the three overflowing spellings.
 */
export const SLACK_STEP = 1 << (5 - SLACK_BITS)

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
