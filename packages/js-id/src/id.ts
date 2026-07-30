/**
 * Prefixed, human-legible IDs for E2B resources.
 *
 * An ID is a three-character kind prefix, an underscore, and the 26-character
 * rotated base32 encoding of a UUID:
 *
 * ```text
 * prj_uk75vf2v7iagp2kgn7pfze3car
 * ^^^ ^
 * |   the encoding of the resource's UUID
 * the kind
 * ```
 *
 * The prefix is what makes an ID readable in a log line, a URL or a support
 * ticket: you can tell at a glance which resource it points at, and a project
 * ID pasted where a volume ID belongs fails loudly instead of looking up a row
 * that happens to exist.
 */

import {
  decodeBytes,
  encodeBytes,
  ENCODED_LENGTH,
  faultInEncoded,
} from './codec'
import { InvalidIdError } from './errors'
import { bytesToUuid, createUuid, uuidToBytes } from './uuid'

/**
 * The E2B resources that have IDs, and the prefix each one carries.
 *
 * This map is the single source of truth for the prefixes; adding a kind is
 * adding a line here.
 */
export const ID_PREFIXES = {
  project: 'prj',
  workspace: 'wrk',
  volume: 'vol',
  sandbox: 'sbx',
  user: 'usr',
  group: 'grp',
} as const

/** What separates the prefix from the encoding. */
const SEPARATOR = '_'

/** A resource kind that has IDs, e.g. `'project'`. */
export type IdKind = keyof typeof ID_PREFIXES

/** The prefix a kind carries, e.g. `'prj'`. */
export type IdPrefix<K extends IdKind = IdKind> = (typeof ID_PREFIXES)[K]

/**
 * An ID of a given kind, e.g. `Id<'project'>` is `` `prj_${string}` ``. With
 * no kind it is an ID of any kind.
 *
 * The type only pins the prefix — a string of the right shape still has to go
 * through {@link isId} or {@link decodeId} to be known good — but it is enough
 * for the compiler to catch a project ID passed where a volume ID belongs.
 */
export type Id<K extends IdKind = IdKind> = `${IdPrefix<K>}_${string}`

/**
 * A parsed ID: which kind it names, and the UUID it carries.
 */
export interface ParsedId {
  /** The resource kind its prefix names. */
  kind: IdKind
  /** The UUID it encodes, in canonical hex form. */
  uuid: string
}

/**
 * How wide every prefix is. The parsing paths do not depend on it — they find
 * the separator and slice by the matched prefix's own length — but IDs are a
 * fixed width only as long as this holds, so it is checked against
 * {@link ID_PREFIXES} rather than assumed.
 */
export const PREFIX_LENGTH = 3

for (const prefix of Object.values(ID_PREFIXES)) {
  if (prefix.length !== PREFIX_LENGTH) {
    throw new Error(
      `@e2b/id: the prefix "${prefix}" is ${prefix.length} characters, not ${PREFIX_LENGTH}, so ID_LENGTH would be wrong for its kind.`
    )
  }
}

/**
 * The width of every ID: a three-character prefix, an underscore and 26
 * characters of encoding.
 *
 * Useful for sizing a database column or aligning a log. It is not a validator
 * — a string of this length can still be nonsense — so reach for {@link isId}
 * when the question is whether an ID is well formed.
 */
export const ID_LENGTH = PREFIX_LENGTH + SEPARATOR.length + ENCODED_LENGTH

/**
 * Prefix to kind, for reading an ID's prefix back.
 *
 * A `Map`, not an object: prefixes come from untrusted strings, and a plain
 * object would answer `KINDS_BY_PREFIX['toString']` with a function inherited
 * from `Object.prototype`, putting `[native code]` in an error message.
 */
const KINDS_BY_PREFIX: ReadonlyMap<string, IdKind> = new Map(
  Object.entries(ID_PREFIXES).map(([kind, prefix]) => [prefix, kind as IdKind])
)

/** `'group', 'project', …` — for error messages that list what is accepted. */
function knownKinds(): string {
  return Object.keys(ID_PREFIXES)
    .sort()
    .map((kind) => `'${kind}'`)
    .join(', ')
}

function prefixOf<K extends IdKind>(kind: K): IdPrefix<K> {
  // Cast so the undefined branch stays reachable to the compiler: an unknown
  // kind cannot come from TypeScript, but it can come from JavaScript or from
  // a cast, and the message it gets should be this one.
  const prefix = ID_PREFIXES[kind] as IdPrefix<K> | undefined
  if (prefix === undefined) {
    throw new InvalidIdError(
      'kind',
      `'${kind}' is not a resource kind that has IDs. Expected one of ${knownKinds()}.`
    )
  }
  return prefix
}

/**
 * Encodes a UUID as an ID of the given kind.
 *
 * @param kind the resource the UUID belongs to.
 * @param uuid the resource's UUID, in canonical hex form.
 * @returns the ID.
 * @throws {InvalidIdError} if `kind` is not a known kind, or `uuid` is not a
 * UUID.
 * @example
 * ```ts
 * encodeId('project', '019fa519-bf79-724d-8811-a2bfda9755fa')
 * // 'prj_uk75vf2v7iagp2kgn7pfze3car'
 * ```
 */
export function encodeId<K extends IdKind>(kind: K, uuid: string): Id<K> {
  return `${prefixOf(kind)}${SEPARATOR}${encodeBytes(uuidToBytes(uuid))}` as Id<K>
}

/**
 * Decodes an ID of the given kind back to its UUID.
 *
 * The kind is required rather than inferred so that a mismatch is an error:
 * this is the check that stops one resource's ID from being used as another's.
 * Use {@link parseId} when the kind is what you are trying to find out.
 *
 * @param kind the resource the ID must name.
 * @param id the ID.
 * @returns the UUID it carries, in canonical hex form.
 * @throws {InvalidIdError} if `id` names a different kind, or is not a
 * well-formed ID.
 * @example
 * ```ts
 * decodeId('project', 'prj_uk75vf2v7iagp2kgn7pfze3car')
 * // '019fa519-bf79-724d-8811-a2bfda9755fa'
 * ```
 */
export function decodeId<K extends IdKind>(kind: K, id: string): string {
  const prefix = prefixOf(kind)
  if (!id.startsWith(`${prefix}${SEPARATOR}`)) {
    const named = KINDS_BY_PREFIX.get(id.slice(0, id.indexOf(SEPARATOR)))
    throw named === undefined
      ? new InvalidIdError(
          'prefix',
          `"${id}" is not a ${kind} ID: expected it to start with "${prefix}${SEPARATOR}".`
        )
      : new InvalidIdError(
          'prefix',
          `"${id}" is a ${named} ID, not a ${kind} ID.`,
          named
        )
  }
  return bytesToUuid(decodeBytes(id.slice(prefix.length + SEPARATOR.length)))
}

/**
 * Mints an ID for a new resource of the given kind, from a fresh
 * {@link createUuid} UUIDv7.
 *
 * @param kind the resource being created.
 * @returns the ID.
 * @throws {InvalidIdError} if `kind` is not a known kind.
 * @example
 * ```ts
 * createId('sandbox') // 'sbx_blo7looa3eagp2kgn75n47fkrk'
 * ```
 */
export function createId<K extends IdKind>(kind: K): Id<K> {
  return encodeId(kind, createUuid())
}

/**
 * Reads an ID without knowing its kind up front.
 *
 * @param id the ID.
 * @returns the kind its prefix names and the UUID it carries.
 * @throws {InvalidIdError} if `id` carries no known prefix, or the rest of it
 * is not a well-formed encoding.
 * @example
 * ```ts
 * parseId('vol_uxl2sotjfiagp2kgn7yv4e3e4g')
 * // { kind: 'volume', uuid: '019fa519-bfc5-784d-9386-a5d7a93a692a' }
 * ```
 */
export function parseId(id: string): ParsedId {
  const separator = id.indexOf(SEPARATOR)
  if (separator < 0) {
    throw new InvalidIdError(
      'prefix',
      `"${id}" is not an ID: expected a kind prefix and an underscore, like "prj${SEPARATOR}".`
    )
  }

  const kind = KINDS_BY_PREFIX.get(id.slice(0, separator))
  if (kind === undefined) {
    throw new InvalidIdError(
      'prefix',
      `"${id}" carries the unknown prefix "${id.slice(0, separator)}". Expected one of ${Object.values(
        ID_PREFIXES
      )
        .sort()
        .map((prefix) => `"${prefix}"`)
        .join(', ')}.`
    )
  }

  return { kind, uuid: decodeId(kind, id) }
}

/**
 * Whether a string is a well-formed ID of the given kind.
 *
 * This is {@link decodeId} without the throw, for validating input you did not
 * mint: it checks the prefix, the width, the alphabet and the canonical
 * spelling.
 *
 * It answers without constructing an error or decoding the UUID, so it is cheap
 * enough to run over a whole request — which matters, because rejection is the
 * common case for untrusted input and building an `Error` (message plus stack
 * capture) costs orders of magnitude more than the check itself.
 *
 * Anything that is not a string is simply not an ID, so `null`, `undefined` and
 * a stray number all return `false` rather than throwing — this is usually the
 * first thing a handler calls on a JSON payload.
 *
 * @param kind the resource the ID must name.
 * @param value the string to check.
 * @returns whether `value` is an ID of that kind.
 * @example
 * ```ts
 * if (!isId('project', input)) {
 *   throw new Error(`${input} is not a project ID`)
 * }
 * ```
 */
export function isId<K extends IdKind>(kind: K, value: string): value is Id<K> {
  if (typeof value !== 'string') return false

  const prefix = ID_PREFIXES[kind] as string | undefined
  if (prefix === undefined) return false
  if (!value.startsWith(prefix + SEPARATOR)) return false

  return (
    faultInEncoded(value.slice(prefix.length + SEPARATOR.length)) === undefined
  )
}
