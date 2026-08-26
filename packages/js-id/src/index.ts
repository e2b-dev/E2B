/**
 * `@e2b/id` — prefixed, human-legible IDs for E2B resources.
 *
 * ```ts
 * import { createId, decodeId, isId, parseId } from '@e2b/id'
 *
 * const id = createId('project') // 'prj_uk75vf2v7iagp2kgn7pfze3car'
 * decodeId('project', id) // '019fa519-bf79-724d-8811-a2bfda9755fa'
 * isId('volume', id) // false
 * parseId(id) // { kind: 'project', uuid: '019fa519-…' }
 * ```
 *
 * An ID is a kind prefix and the 26-character rotated base32 encoding of a
 * UUID. See `id.ts` for what the prefix buys and `codec.ts` for what the
 * rotation buys.
 */

export {
  ALPHABET,
  DECODED_LENGTH,
  decodeBytes,
  encodeBytes,
  ENCODED_LENGTH,
} from './codec'
export { InvalidIdError } from './errors'
export type { InvalidIdReason } from './errors'
export {
  createId,
  decodeId,
  encodeId,
  ID_LENGTH,
  ID_PREFIXES,
  PREFIX_LENGTH,
  isId,
  parseId,
} from './id'
export type { Id, IdKind, IdPrefix, ParsedId } from './id'
export { bytesToUuid, createUuid, uuidToBytes } from './uuid'
