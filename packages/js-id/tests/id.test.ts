import { afterEach, describe, expect, test, vi } from 'vitest'

import { ALPHABET, ENCODED_LENGTH } from '../src/codec'
import { InvalidIdError } from '../src/errors'
import {
  createId,
  decodeId,
  encodeId,
  type Id,
  ID_LENGTH,
  ID_PREFIXES,
  type IdKind,
  isId,
  parseId,
  PREFIX_LENGTH,
} from '../src/id'
import { bytesToUuid, createUuid, uuidToBytes } from '../src/uuid'
import { corpus, GOLDEN, GOLDEN_IDS, hex } from './vectors'

const KINDS = Object.keys(ID_PREFIXES) as IdKind[]

describe('the prefixes', () => {
  test('every kind has a distinct three-character prefix', () => {
    const prefixes = Object.values(ID_PREFIXES)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    for (const prefix of prefixes) {
      expect(prefix).toMatch(/^[a-z]{3}$/)
    }
    expect(ID_LENGTH).toBe(3 + 1 + ENCODED_LENGTH)
  })

  test('every kind is covered here', () => {
    expect(KINDS).toStrictEqual([
      'project',
      'workspace',
      'secret',
      'volume',
      'sandbox',
      'user',
      'group',
    ])
    expect(GOLDEN_IDS.map(([kind]) => kind).sort()).toStrictEqual(
      [...KINDS].sort()
    )
  })
})

describe('encoding and decoding ids', () => {
  test.each(GOLDEN_IDS)('a %s id for %s is %s', (kind, uuid, id) => {
    expect(encodeId(kind, uuid)).toBe(id)
    expect(decodeId(kind, id)).toBe(uuid)
    expect(parseId(id)).toStrictEqual({ kind, uuid })
    expect(isId(kind, id)).toBe(true)
  })

  test('every id is ID_LENGTH characters wide', () => {
    for (const kind of KINDS) {
      for (const [uuid] of GOLDEN) {
        expect(encodeId(kind, uuid)).toHaveLength(ID_LENGTH)
      }
    }
  })

  test('every value round trips through every kind', () => {
    for (const bytes of corpus()) {
      const uuid = bytesToUuid(bytes)
      for (const kind of KINDS) {
        const id = encodeId(kind, uuid)
        expect(id.startsWith(`${ID_PREFIXES[kind]}_`), id).toBe(true)
        expect(decodeId(kind, id), hex(bytes)).toBe(uuid)
        expect(parseId(id)).toStrictEqual({ kind, uuid })
      }
    }
  })

  // `Id<K>` is a template literal type, so the prefix is a compile-time fact
  // too: this test would fail to typecheck if it stopped being one.
  test('the id type carries the kind', () => {
    const value: string = GOLDEN_IDS[0][2]

    if (!isId('project', value)) throw new Error('golden id did not validate')
    const narrowed: Id<'project'> = value
    expect(narrowed).toBe(value)

    // @ts-expect-error a project id is not a volume id
    const mismatched: Id<'volume'> = createId('project')
    expect(mismatched).toHaveLength(ID_LENGTH)
  })

  test('uuids are accepted in either case and returned in lowercase', () => {
    const uuid = '019fa519-bf79-724d-8811-a2bfda9755fa'
    expect(encodeId('project', uuid.toUpperCase())).toBe(
      encodeId('project', uuid)
    )
    expect(decodeId('project', encodeId('project', uuid))).toBe(uuid)
  })

  // The four spellings google/uuid's Parse takes, so a UUID string the Go
  // side accepts is one this package accepts, and both encode it the same.
  test.each([
    ['hyphenated', '019fa519-bf79-724d-8811-a2bfda9755fa'],
    ['urn-prefixed', 'urn:uuid:019fa519-bf79-724d-8811-a2bfda9755fa'],
    [
      'urn-prefixed in upper case',
      'URN:UUID:019FA519-BF79-724D-8811-A2BFDA9755FA',
    ],
    ['braced', '{019fa519-bf79-724d-8811-a2bfda9755fa}'],
    ['bare', '019fa519bf79724d8811a2bfda9755fa'],
  ])('a uuid that is %s is accepted', (_, uuid) => {
    expect(encodeId('project', uuid)).toBe('prj_01kyjhkfvse96rg4d2qzd9enft')
    expect(uuidToBytes(uuid)).toStrictEqual(
      uuidToBytes('019fa519-bf79-724d-8811-a2bfda9755fa')
    )
  })

  // Nothing reads the version or variant: Go does not, so a 128-bit value
  // that is not an RFC 9562 UUID still encodes, and to the same string.
  test('a non-rfc value still parses', () => {
    expect(uuidToBytes('26064700-4700-0000-0000-000000001111')).toStrictEqual(
      uuidToBytes('26064700470000000000000000001111')
    )
  })
})

describe('minting ids', () => {
  test('createId produces an id of the kind asked for', () => {
    for (const kind of KINDS) {
      const id = createId(kind)
      expect(id).toHaveLength(ID_LENGTH)
      expect(isId(kind, id)).toBe(true)
      expect(parseId(id).kind).toBe(kind)
    }
  })

  test('createUuid mints v7s that carry the current time', () => {
    const before = Date.now()
    const uuid = createUuid()
    const after = Date.now()

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )

    const bytes = uuidToBytes(uuid)
    let ms = 0
    for (const byte of bytes.subarray(0, 6)) ms = ms * 256 + byte
    expect(ms).toBeGreaterThanOrEqual(before)
    expect(ms).toBeLessThanOrEqual(after)
  })

  test('createUuid does not repeat itself', () => {
    const minted = new Set(Array.from({ length: 1000 }, () => createUuid()))
    expect(minted.size).toBe(1000)
  })

  // The point of minting from v7: the bytes a database stores sort by time,
  // and so do the IDs made from them. Only to the millisecond — within one,
  // the rest of the UUID is random and nothing here adds a counter — so the
  // timestamp field is what is ordered.
  test('uuids minted in order carry timestamps in order', () => {
    const timestamps = Array.from({ length: 1000 }, () =>
      createUuid().slice(0, 13)
    )
    expect([...timestamps].sort()).toStrictEqual(timestamps)
  })

  test('and so do the ids minted from them', () => {
    const fronts = Array.from({ length: 1000 }, () =>
      createId('sandbox').slice(0, 4 + 10)
    )
    expect([...fronts].sort()).toStrictEqual(fronts)
  })
})

describe('minting the way google/uuid does', () => {
  afterEach(() => vi.restoreAllMocks())

  // The first 8 bytes are the timestamp, the version and the sequence; the
  // sequence is what makes two calls in the same millisecond ordered, so the
  // whole UUID strictly increases call by call, not just its timestamp.
  test('every uuid is greater than the one before', () => {
    const minted = Array.from({ length: 5000 }, () => createUuid())
    for (let i = 1; i < minted.length; i++) {
      expect(
        minted[i] > minted[i - 1],
        `${minted[i - 1]} then ${minted[i]}`
      ).toBe(true)
    }
  })

  // The mocked clocks are in 2100, past anything already handed out: the
  // state is per process and never goes backwards, so a mock in the past
  // would just be another stalled clock.
  test('even when the clock stalls', () => {
    vi.spyOn(Date, 'now').mockReturnValue(4102444800000)

    // More than the 4096 the sequence holds: it has to carry into the
    // timestamp, which Go's getV7Time does by adding one to the packed value.
    const minted = Array.from({ length: 5000 }, () => createUuid())
    expect(new Set(minted).size).toBe(minted.length)
    for (let i = 1; i < minted.length; i++) {
      expect(minted[i] > minted[i - 1]).toBe(true)
    }

    const timestamps = new Set(minted.map((uuid) => uuid.slice(0, 13)))
    expect(timestamps.size).toBe(2)
    const sequences = minted
      .slice(0, 4096)
      .map((uuid) => Number.parseInt(uuid.slice(15, 18), 16))
    expect(sequences).toStrictEqual(sequences.map((_, i) => i))
  })

  test('and when it steps back', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(4102444800000)
    const before = createUuid()
    now.mockReturnValue(4102444700000)
    const after = createUuid()
    expect(after > before).toBe(true)
    expect(after.slice(0, 13)).toBe(before.slice(0, 13))
  })

  test('the layout is a v7 with the sequence in rand_a', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0x03c0a519bf79)
    const uuid = createUuid()
    expect(uuid).toMatch(
      /^03c0a519-bf79-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})

describe('a mismatched kind is an error', () => {
  const [, uuid, projectId] = GOLDEN_IDS[0]

  test('decodeId names both kinds', () => {
    expect(() => decodeId('volume', projectId)).toThrow(InvalidIdError)
    expect(() => decodeId('volume', projectId)).toThrow(
      /is a project ID, not a volume ID/
    )
  })

  test('isId is false for every other kind', () => {
    for (const kind of KINDS) {
      expect(isId(kind, projectId)).toBe(kind === 'project')
    }
  })

  test('an unknown prefix says what is accepted', () => {
    const id = `tpl_${projectId.slice(4)}`
    expect(() => parseId(id)).toThrow(/unknown prefix "tpl"/)
    expect(() => decodeId('project', id)).toThrow(
      /expected it to start with "prj_"/
    )
    expect(isId('project', id)).toBe(false)
  })

  test('so does an unknown kind', () => {
    // Reachable from JavaScript, and from TypeScript through a cast, so the
    // check has to be a runtime one.
    expect(() => encodeId('template' as IdKind, uuid)).toThrow(
      /'template' is not a resource kind/
    )
  })
})

describe('malformed ids are rejected', () => {
  const projectId = GOLDEN_IDS[0][2]

  test.each([
    ['nothing at all', ''],
    ['a bare encoding with no prefix', projectId.slice(4)],
    ['a prefix with no encoding', 'prj_'],
    ['no separator', projectId.replace('_', '')],
    ['a hyphen instead of an underscore', projectId.replace('_', '-')],
    ['one character short', projectId.slice(0, -1)],
    ['one character long', `${projectId}a`],
    ['uppercase', projectId.toUpperCase()],
    ['an uppercase prefix', `PRJ_${projectId.slice(4)}`],
    ['a character outside the alphabet', `${projectId.slice(0, -1)}i`],
    ['surrounding whitespace', ` ${projectId} `],
    ['an overflowing leading character', `prj_z${projectId.slice(5)}`],
  ])('%s', (_, value) => {
    expect(isId('project', value)).toBe(false)
    expect(() => decodeId('project', value)).toThrow(InvalidIdError)
  })

  test('the overflow case is really the only bits flipped', () => {
    // Index 4 of the id is the leading digit of the encoding. Setting its two
    // high bits leaves a string that a decoder keeping the low 128 bits would
    // happily map to the same UUID; the Go side rejects it as this one does.
    const digit = ALPHABET.indexOf(projectId[4])
    const overflowing = `prj_${ALPHABET[digit | 24]}${projectId.slice(5)}`
    expect(overflowing).toHaveLength(ID_LENGTH)
    expect(overflowing).not.toBe(projectId)
    expect(() => decodeId('project', overflowing)).toThrow(/above 128 bits/)
  })

  test.each([
    ['not hex', 'not-a-uuid'],
    ['one digit short', '019fa519-bf79-724d-8811-a2bfda9755f'],
    ['one digit long', '019fa519-bf79-724d-8811-a2bfda9755faa'],
    ['empty', ''],
    // Hyphens anywhere but 8-4-4-4-12: Go checks the four positions.
    ['hyphenated in the wrong places', '019fa519bf79-724d-8811-a2bf-da9755fa'],
    ['bare but with one hyphen', '019fa519-bf79724d8811a2bfda9755fa'],
    // The prefix has to be the URN one, and the braces have to be braces —
    // Go would take "[…]" since it never looks at them, but that is not a
    // spelling anyone writes on purpose.
    [
      'prefixed with something else',
      'uuid:uuid:019fa519-bf79-724d-8811-a2bfda9755fa',
    ],
    ['bracketed', '[019fa519-bf79-724d-8811-a2bfda9755fa]'],
    ['half braced', '{019fa519-bf79-724d-8811-a2bfda9755fa '],
    [
      'braced and urn-prefixed',
      '{urn:uuid:019fa519-bf79-724d-8811-a2bfda9755fa}',
    ],
    ['surrounded by whitespace', ' 019fa519-bf79-724d-8811-a2bfda9755fa '],
  ])('encodeId rejects a uuid that is %s', (_, uuid) => {
    expect(() => encodeId('project', uuid)).toThrow(InvalidIdError)
    expect(() => encodeId('project', uuid)).toThrow(
      expect.objectContaining({ reason: 'uuid' })
    )
  })
})

describe('the fixes the review found', () => {
  const projectId = GOLDEN_IDS[0][2]

  // A plain object would answer `KINDS_BY_PREFIX['toString']` with an inherited
  // function, putting `[native code]` into a user-facing message — and Python,
  // whose dict.get does not inherit, would report something else for the same
  // input.
  test.each(['toString', 'valueOf', 'constructor', 'hasOwnProperty'])(
    'the prefix %s does not reach Object.prototype',
    (prefix) => {
      const id = `${prefix}_${projectId.slice(4)}`
      expect(() => parseId(id)).toThrow(
        new RegExp(`carries the unknown prefix "${prefix}"`)
      )
      expect(() => decodeId('project', id)).toThrow(
        /expected it to start with "prj_"/
      )
      expect(isId('project', id)).toBe(false)
    }
  )

  // `__proto__` cannot reach the lookup at all — it leads with the separator, so
  // the prefix parses as empty — but it is worth pinning that it is rejected
  // rather than doing anything exotic.
  test('a leading underscore parses as an empty prefix', () => {
    const id = `__proto___${projectId.slice(4)}`
    expect(() => parseId(id)).toThrow(/carries the unknown prefix ""/)
    expect(isId('project', id)).toBe(false)
  })

  // isId is the first thing a handler calls on a JSON payload, so a null or a
  // number has to be `false`, not a TypeError.
  test.each([null, undefined, 123, ['x'], {}, Symbol('x')])(
    'isId(%s) is false rather than a throw',
    (value) => {
      expect(isId('project', value as unknown as string)).toBe(false)
    }
  )

  test('an unknown kind is false rather than a throw', () => {
    expect(isId('template' as IdKind, projectId)).toBe(false)
  })

  // Callers branch on `reason`, never on the message, so rewording a message
  // stays a cosmetic change.
  test.each([
    ['prefix', 'volume' as IdKind, projectId],
    ['prefix', 'project' as IdKind, `tpl_${projectId.slice(4)}`],
    ['prefix', 'project' as IdKind, projectId.slice(4)],
    ['length', 'project' as IdKind, projectId.slice(0, -1)],
    ['alphabet', 'project' as IdKind, `${projectId.slice(0, -1)}i`],
    ['overflow', 'project' as IdKind, `prj_z${projectId.slice(5)}`],
  ])('the reason for a %s failure', (reason, kind, value) => {
    try {
      decodeId(kind, value)
      expect.fail(`decodeId should have rejected ${value}`)
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidIdError)
      expect((error as InvalidIdError).reason).toBe(reason)
    }
  })

  test('the reason for a bad uuid and an unknown kind', () => {
    expect(() => encodeId('project', 'not-a-uuid')).toThrow(
      expect.objectContaining({ reason: 'uuid' })
    )
    expect(() => encodeId('template' as IdKind, GOLDEN_IDS[0][1])).toThrow(
      expect.objectContaining({ reason: 'kind' })
    )
  })

  test('a kind mismatch reports the kind it actually names', () => {
    try {
      decodeId('volume', projectId)
      expect.fail('should have thrown')
    } catch (error) {
      expect((error as InvalidIdError).actualKind).toBe('project')
    }
  })

  test('every prefix is PREFIX_LENGTH wide, which is what ID_LENGTH assumes', () => {
    for (const prefix of Object.values(ID_PREFIXES)) {
      expect(prefix).toHaveLength(PREFIX_LENGTH)
    }
    expect(ID_LENGTH).toBe(PREFIX_LENGTH + 1 + ENCODED_LENGTH)
  })
})

// Nothing else imports the barrel, so without this a typo in a re-export ships.
describe('the public entry point', () => {
  test('re-exports every name the README documents', async () => {
    const entry = await import('../src/index')

    for (const name of [
      'ALPHABET',
      'DECODED_LENGTH',
      'ENCODED_LENGTH',
      'ID_LENGTH',
      'ID_PREFIXES',
      'PREFIX_LENGTH',
      'InvalidIdError',
      'bytesToUuid',
      'createId',
      'createUuid',
      'decodeBytes',
      'decodeId',
      'encodeBytes',
      'encodeId',
      'isId',
      'parseId',
      'uuidToBytes',
    ]) {
      expect(entry, name).toHaveProperty(name)
    }

    expect(entry.createId('project')).toHaveLength(entry.ID_LENGTH)
    expect(entry.PREFIX_LENGTH).toBe(3)
  })
})
