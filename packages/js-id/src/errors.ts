import type { IdKind } from './id'

/**
 * Why a string was rejected. Callers that need to react differently per cause —
 * hint at the right kind, count overflowing spellings, plain-400 the rest —
 * branch on this rather than on the message, which is prose and may be reworded.
 *
 * - `kind`: the kind asked for is not one this package knows.
 * - `prefix`: the ID names a different kind, or none, or is not a string.
 * - `length`: the encoding is not {@link ENCODED_LENGTH} characters.
 * - `alphabet`: it holds a character outside the lowercase Crockford alphabet.
 * - `overflow`: its leading character is above `7`, so it spells a value no 16
 *   bytes can hold — one of the three non-canonical spellings of a value.
 * - `uuid`: the UUID given was not in one of the four forms `google/uuid`
 *   accepts.
 */
export type InvalidIdReason =
  'kind' | 'prefix' | 'length' | 'alphabet' | 'overflow' | 'uuid'

/**
 * Thrown when a string is not a well-formed ID, encoding or UUID.
 *
 * Every failure mode of this package is one of these; {@link reason} says which.
 * Use {@link isId} when a boolean is what you want — it does not construct an
 * error at all.
 */
export class InvalidIdError extends Error {
  /** Why the string was rejected. */
  readonly reason: InvalidIdReason

  /**
   * The kind the ID's prefix actually names, when it names a known one — set
   * only for `reason: 'prefix'`, so `expected X, got Y` is available without
   * parsing the message.
   */
  readonly actualKind?: IdKind

  constructor(reason: InvalidIdReason, message: string, actualKind?: IdKind) {
    super(message)
    this.name = 'InvalidIdError'
    this.reason = reason
    this.actualKind = actualKind
  }
}
