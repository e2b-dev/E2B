import { describe, expect, test } from 'vitest'

import { ENCODED_LENGTH } from '../src/codec'
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

  // The point of minting from v7: the bytes a database stores sort by time.
  // Only to the millisecond — within one, the rest of the UUID is random and
  // nothing here adds a counter — so the timestamp field is what is ordered.
  test('uuids minted in order carry timestamps in order', () => {
    const timestamps = Array.from({ length: 1000 }, () =>
      createUuid().slice(0, 13)
    )
    expect([...timestamps].sort()).toStrictEqual(timestamps)
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
    ['a character outside the alphabet', `${projectId.slice(0, -1)}0`],
    ['surrounding whitespace', ` ${projectId} `],
    [
      'a non-canonical spelling',
      `${projectId.slice(0, 13)}j${projectId.slice(14)}`,
    ],
  ])('%s', (_, value) => {
    expect(isId('project', value)).toBe(false)
    expect(() => decodeId('project', value)).toThrow(InvalidIdError)
  })

  test('the non-canonical case is really the only bit flipped', () => {
    // Index 13 of the id is index 9 of the encoding, the slack digit. Setting
    // its low bits leaves a string that a permissive base32 decoder would
    // happily map to the same UUID.
    const nonCanonical = `${projectId.slice(0, 13)}j${projectId.slice(14)}`
    expect(nonCanonical).toHaveLength(ID_LENGTH)
    expect(nonCanonical).not.toBe(projectId)
    expect(() => decodeId('project', nonCanonical)).toThrow(/canonical/)
  })

  test.each([
    ['not hex', 'not-a-uuid'],
    ['unhyphenated', '019fa519bf79724d8811a2bfda9755fa'],
    ['braced', '{019fa519-bf79-724d-8811-a2bfda9755fa}'],
    ['urn-prefixed', 'urn:uuid:019fa519-bf79-724d-8811-a2bfda9755fa'],
    ['one digit short', '019fa519-bf79-724d-8811-a2bfda9755f'],
    ['empty', ''],
  ])('encodeId rejects a uuid that is %s', (_, uuid) => {
    expect(() => encodeId('project', uuid)).toThrow(InvalidIdError)
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
    ['alphabet', 'project' as IdKind, `${projectId.slice(0, -1)}0`],
    [
      'canonical',
      'project' as IdKind,
      `${projectId.slice(0, 13)}j${projectId.slice(14)}`,
    ],
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
