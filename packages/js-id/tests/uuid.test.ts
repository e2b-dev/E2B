import { runInNewContext } from 'node:vm'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { DECODED_LENGTH } from '../src/codec'
import { InvalidIdError } from '../src/errors'
import { bytesToUuid, uuidToBytes } from '../src/uuid'
import { corpus, hex } from './vectors'

/**
 * The module under test, loaded fresh: `createUuid` keeps the last timestamp and
 * sequence in module state, so each clock test gets its own copy rather than
 * inheriting whatever an earlier test (or a mocked year 2100) left behind.
 */
async function freshUuidModule() {
  vi.resetModules()
  return import('../src/uuid')
}

/** An independent formatter: `toString(16)` and a regex, no lookup table. */
function referenceUuid(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}

/** The 48-bit millisecond timestamp at the front of a v7. */
function timestampOf(uuid: string): number {
  return Number.parseInt(uuid.replaceAll('-', '').slice(0, 12), 16)
}

/** The 12-bit sequence in `rand_a`, after the version nibble. */
function sequenceOf(uuid: string): number {
  return Number.parseInt(uuid.slice(15, 18), 16)
}

function expectUuidError(call: () => unknown) {
  expect(call).toThrow(InvalidIdError)
  expect(call).toThrow(expect.objectContaining({ reason: 'uuid' }))
}

describe('uuidToBytes', () => {
  test('reads the digits most significant first', () => {
    expect(
      Array.from(uuidToBytes('019fa519-bf79-724d-8811-a2bfda9755fa'))
    ).toStrictEqual([
      0x01, 0x9f, 0xa5, 0x19, 0xbf, 0x79, 0x72, 0x4d, 0x88, 0x11, 0xa2, 0xbf,
      0xda, 0x97, 0x55, 0xfa,
    ])
  })

  test('reads every hex digit in either case', () => {
    expect(
      Array.from(uuidToBytes('0123456789abcdefABCDEF0123456789'))
    ).toStrictEqual([
      0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xab, 0xcd, 0xef, 0x01,
      0x23, 0x45, 0x67, 0x89,
    ])
  })

  test('agrees with the reference formatter over the corpus', () => {
    for (const bytes of corpus()) {
      const uuid = referenceUuid(bytes)
      expect(uuidToBytes(uuid), hex(bytes)).toStrictEqual(bytes)
      expect(uuidToBytes(uuid.toUpperCase()), hex(bytes)).toStrictEqual(bytes)
      expect(uuidToBytes(uuid.replaceAll('-', '')), hex(bytes)).toStrictEqual(
        bytes
      )
    }
  })

  // google/uuid's Parse dispatches on length, so each form is probed one
  // character either side of its length and with one bad character inside it.
  const uuid = '019fa519-bf79-724d-8811-a2bfda9755fa'
  test.each([
    ['hyphenated, one short', uuid.slice(0, -1)],
    ['hyphenated, one long', `${uuid}0`],
    ['hyphenated, a non-hex digit', `${uuid.slice(0, -1)}g`],
    ['hyphenated, a hyphen where a digit goes', `${uuid.slice(0, -1)}-`],
    ['urn, one short', `urn:uuid:${uuid.slice(0, -1)}`],
    ['urn, one long', `urn:uuid:${uuid}0`],
    ['urn, the wrong prefix', `urn:uid::${uuid}`],
    ['urn, a non-hex digit', `urn:uuid:${uuid.slice(0, -1)}g`],
    ['braced, one short', `{${uuid.slice(0, -1)}}`],
    ['braced, one long', `{${uuid}0}`],
    ['braced, the wrong closing brace', `{${uuid})`],
    ['braced, a non-hex digit', `{${uuid.slice(0, -1)}g}`],
    ['bare, one short', uuid.replaceAll('-', '').slice(0, -1)],
    ['bare, one long', `${uuid.replaceAll('-', '')}0`],
    ['bare, a non-hex digit', `${uuid.replaceAll('-', '').slice(0, -1)}g`],
  ])('rejects %s', (_, value) => {
    expectUuidError(() => uuidToBytes(value))
  })

  // A UUID column read out of JSON can be anything; the answer still has to be
  // an InvalidIdError, and a symbol must not throw from the message itself.
  test.each([null, undefined, 123, {}, [], Symbol('x'), new Uint8Array(16)])(
    'rejects %s, which is not a string',
    (value) => {
      expectUuidError(() => uuidToBytes(value as unknown as string))
    }
  )
})

describe('bytesToUuid', () => {
  test('formats the canonical lowercase hyphenated form', () => {
    expect(
      bytesToUuid(
        new Uint8Array([
          0x01, 0x9f, 0xa5, 0x19, 0xbf, 0x79, 0x72, 0x4d, 0x88, 0x11, 0xa2,
          0xbf, 0xda, 0x97, 0x55, 0xfa,
        ])
      )
    ).toBe('019fa519-bf79-724d-8811-a2bfda9755fa')
  })

  test('formats every byte value as two lowercase digits', () => {
    for (let byte = 0; byte < 256; byte++) {
      const bytes = new Uint8Array(DECODED_LENGTH).fill(byte)
      expect(bytesToUuid(bytes)).toBe(referenceUuid(bytes))
    }
  })

  test('agrees with the reference formatter over the corpus', () => {
    for (const bytes of corpus()) {
      expect(bytesToUuid(bytes), hex(bytes)).toBe(referenceUuid(bytes))
      expect(uuidToBytes(bytesToUuid(bytes)), hex(bytes)).toStrictEqual(bytes)
    }
  })

  test('takes a Buffer, which is a Uint8Array', () => {
    const bytes = new Uint8Array(DECODED_LENGTH).fill(0xab)
    expect(bytesToUuid(Buffer.from(bytes))).toBe(bytesToUuid(bytes))
  })

  test('takes a Uint8Array from another realm', () => {
    const Foreign = runInNewContext('Uint8Array') as Uint8ArrayConstructor
    const bytes = new Foreign(DECODED_LENGTH).fill(0xab)
    expect(bytes instanceof Uint8Array).toBe(false)
    expect(bytesToUuid(bytes)).toBe('abababab-abab-abab-abab-abababababab')
  })

  test.each([0, 1, 15, 17, 32])('rejects %i bytes', (length) => {
    expectUuidError(() => bytesToUuid(new Uint8Array(length)))
  })

  // Without the check a plain array of 16 numbers above 255 formatted as
  // "undefinedundefined…", and null was a TypeError.
  test.each([
    ['null', null],
    ['undefined', undefined],
    ['a string of 16 characters', '0123456789abcdef'],
    ['a plain array', Array.from({ length: 16 }, () => 256)],
    ['a Uint16Array', new Uint16Array(16).fill(0xffff)],
  ])('rejects %s', (_, value) => {
    expectUuidError(() => bytesToUuid(value as unknown as Uint8Array))
  })
})

describe('createUuid', () => {
  afterEach(() => vi.restoreAllMocks())

  test('every uuid is a v7 with the RFC 9562 variant', async () => {
    const { createUuid } = await freshUuidModule()
    // The variant overwrites two random bits, so it takes many draws to be
    // sure no random value leaks through.
    for (let i = 0; i < 2000; i++) {
      const bytes = uuidToBytes(createUuid())
      expect(bytes[6] >> 4).toBe(7)
      expect(bytes[8] & 0xc0).toBe(0x80)
    }
  })

  // The 48-bit timestamp is split across division and 32-bit shifts, so the
  // values either side of 2^32 and the top of the range are the ones to pin.
  test.each([0, 1, 0xffffffff, 0x100000000, 0x03c0a519bf79, 2 ** 48 - 1])(
    'writes the timestamp %i big-endian into the first six bytes',
    async (ms) => {
      const { createUuid } = await freshUuidModule()
      vi.spyOn(Date, 'now').mockReturnValue(ms)
      const uuid = createUuid()
      expect(timestampOf(uuid)).toBe(ms)
      expect(sequenceOf(uuid)).toBe(0)
    }
  )

  // Random bits only fill rand_b and the low bits of the variant byte: with a
  // generator of all ones or all zeros the timestamp, version and sequence are
  // unchanged and the variant byte is exactly 0xbf or 0x80.
  test.each([
    [0xff, 'bf', 'ffffffffffffff'],
    [0x00, '80', '00000000000000'],
  ])('random byte %i only reaches rand_b', async (fill, variant, rest) => {
    const { createUuid } = await freshUuidModule()
    vi.spyOn(Date, 'now').mockReturnValue(0x03c0a519bf79)
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint8Array).fill(fill)
      return array
    })
    expect(createUuid()).toBe(
      `03c0a519-bf79-7000-${variant}${rest.slice(0, 2)}-${rest.slice(2)}`
    )
  })

  test('the sequence counts up within a millisecond and resets on the next', async () => {
    const { createUuid } = await freshUuidModule()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    expect(
      [createUuid(), createUuid(), createUuid()].map(sequenceOf)
    ).toStrictEqual([0, 1, 2])

    now.mockReturnValue(1_000_001)
    const next = createUuid()
    expect(timestampOf(next)).toBe(1_000_001)
    expect(sequenceOf(next)).toBe(0)
  })

  test('a full sequence carries into the next millisecond', async () => {
    const { createUuid } = await freshUuidModule()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const minted = Array.from({ length: 4096 }, () => createUuid())
    expect(sequenceOf(minted[4095])).toBe(4095)

    const carried = createUuid()
    expect(timestampOf(carried)).toBe(1_000_001)
    expect(sequenceOf(carried)).toBe(0)

    // The clock still reads the old millisecond, which is now behind: the
    // carried one keeps counting rather than going back.
    expect(sequenceOf(createUuid())).toBe(1)

    // Once the clock catches up with the carried millisecond it is a stall
    // there too, and once it passes it the sequence starts over.
    now.mockReturnValue(1_000_001)
    expect(sequenceOf(createUuid())).toBe(2)
    now.mockReturnValue(1_000_002)
    expect(sequenceOf(createUuid())).toBe(0)
  })

  test('a clock that steps back keeps the last millisecond', async () => {
    const { createUuid } = await freshUuidModule()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const before = createUuid()
    now.mockReturnValue(500_000)
    const after = createUuid()
    expect(timestampOf(after)).toBe(1_000_000)
    expect(sequenceOf(after)).toBe(sequenceOf(before) + 1)
    expect(after > before).toBe(true)
  })
})
