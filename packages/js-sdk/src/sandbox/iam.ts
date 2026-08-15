import { InvalidArgumentError } from '../errors'

/**
 * Characters a workload token name cannot carry.
 *
 * The egress proxy reads a placeholder as everything between
 * `'${e2b.identity.tokens.'` and the next `}`, then looks that name up in the
 * registered tokens. A brace in the name breaks that in both directions: `}`
 * ends the placeholder early, so `'a}b'` resolves the unrelated token `'a'` and
 * leaves `'b}'` as literal text, and `{` lets a name close its own placeholder
 * and open another one, minting a token the caller never referenced. Control
 * characters are rejected separately because they cannot appear in an HTTP
 * header value at all — the API would answer with an opaque 400.
 */
const INVALID_IAM_TOKEN_NAME_CHARS = /[{}\p{Cc}]/u

/**
 * The error a lookup of an unregistered token name answers with.
 */
function unregisteredIamTokenError(
  name: string,
  tokenNames: string[]
): InvalidArgumentError {
  const hint =
    tokenNames.length === 0
      ? `Pass it to Sandbox.create as iam: { tokens: { '${name}': Secret.iamToken({ audience, tokenType }) } }.`
      : `Registered tokens: ${tokenNames.map((known) => `'${known}'`).join(', ')}.`

  return new InvalidArgumentError(
    `Network transform references iam token '${name}', which is not registered. ${hint}`
  )
}

/**
 * The error any attempt to mutate the token map answers with.
 */
function readOnlyIamTokensError(prop: string | symbol): InvalidArgumentError {
  return new InvalidArgumentError(
    `Network transform cannot add, change or delete iam token '${String(prop)}': iam.tokens is read-only. Register it with Sandbox.create as iam: { tokens: { '${String(prop)}': Secret.iamToken({ audience, tokenType }) } }.`
  )
}

/**
 * Make `value` unusable as a rule value: coercing it to a primitive — what a
 * template literal, `String()` or an assignment into a header does — throws
 * instead of yielding `undefined` or `function toString() { [native code] }`.
 *
 * This is what lets a runtime probe be served without reopening the guard: the
 * runtime calls the value for the one thing it needs, and a callback that spells
 * the probe into a rule still fails at sandbox creation.
 */
function throwWhenCoerced<T extends object>(
  value: T,
  onCoerce: () => never
): T {
  const descriptor = { value: onCoerce, writable: false, configurable: false }

  return Object.defineProperties(value, {
    [Symbol.toPrimitive]: descriptor,
    toString: descriptor,
    valueOf: descriptor,
  })
}

/**
 * Reject a token name that cannot survive the placeholder grammar.
 *
 * @param name workload token name.
 *
 * @throws {@link InvalidArgumentError} if the name is empty or carries a brace
 * or control character.
 */
export function validateIamTokenName(name: string): void {
  if (name.length === 0 || INVALID_IAM_TOKEN_NAME_CHARS.test(name)) {
    throw new InvalidArgumentError(
      `iam token name ${JSON.stringify(name)} is not usable: a token name cannot be empty or contain '{', '}' or control characters, because it is interpolated into the '\${e2b.identity.tokens.<name>}' placeholder the egress proxy resolves.`
    )
  }
}

/**
 * The placeholder the egress proxy replaces with a freshly minted token. The
 * spelling is fixed by the backend: a placeholder can only select a persisted
 * named token, never an inline audience or claim.
 */
export function iamTokenPlaceholder(name: string): string {
  validateIamTokenName(name)

  return `\${e2b.identity.tokens.${name}}`
}

/**
 * Token name to placeholder map, as exposed to a network `transform` callback.
 *
 * `tokenNames` are the workload tokens the request registers. Referencing any
 * other name throws: the proxy never turns an unregistered name into a token, so
 * a typo would surface as a confusing auth failure at the destination instead of
 * an error here.
 *
 * `validate: false` is for the update-network endpoint, whose payload carries no
 * `iam` config — the sandbox's registered token names are not known client-side
 * there, so any name resolves to its placeholder.
 */
export function iamTokenPlaceholders(
  tokenNames: string[],
  { validate }: { validate: boolean }
): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const name of tokenNames) {
    tokens[name] = iamTokenPlaceholder(name)
  }

  return new Proxy(tokens, {
    get(target, prop, receiver) {
      // `String(iam.tokens)`, `${iam.tokens}` and `iam.tokens + ''` resolve
      // through `Symbol.toPrimitive` whenever it is defined, so serving it here
      // keeps coercing the map to a string working — and keeps `toString` and
      // `valueOf` subject to the guard below instead of doubling as a way
      // around it. The answers match what the plain object gave before.
      if (prop === Symbol.toPrimitive) {
        return (hint: string) => (hint === 'number' ? NaN : '[object Object]')
      }

      if (
        typeof prop === 'string' &&
        // Own keys only: a bare `in` also matches inherited `Object.prototype`
        // members, so an unregistered token named `constructor` or `__proto__`
        // would resolve to a built-in instead of being reported. Python's
        // mapping treats them as missing too.
        !Object.hasOwn(target, prop)
      ) {
        if (!validate) {
          return iamTokenPlaceholder(prop)
        }

        // `JSON.stringify` reads `toJSON` and the await machinery reads `then`
        // off anything they touch, and neither can be served through
        // `Symbol.toPrimitive`. Exempting the two names from the guard is what
        // used to put `Bearer undefined` on the wire, so they are served a value
        // that does the runtime's job and throws as soon as a callback spells it
        // into a rule. `then` is deliberately not callable, so `await` treats
        // the map as a plain value rather than an unsettling thenable.
        const onCoerce = () => {
          throw unregisteredIamTokenError(prop, tokenNames)
        }

        if (prop === 'toJSON') {
          return throwWhenCoerced(() => ({ ...target }), onCoerce)
        }

        if (prop === 'then') {
          return throwWhenCoerced({}, onCoerce)
        }

        throw unregisteredIamTokenError(prop, tokenNames)
      }

      return Reflect.get(target, prop, receiver)
    },

    // `Object.getOwnPropertyDescriptor(iam.tokens, name)?.value` is a lookup
    // too: without this trap an unregistered name answers `undefined` and lands
    // on the wire as `Bearer undefined`, exactly what the `get` guard prevents.
    // Registered names still report an honest descriptor, so `Object.keys`,
    // spreading and `JSON.stringify` are unaffected.
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && !Object.hasOwn(target, prop)) {
        if (!validate) {
          return {
            value: iamTokenPlaceholder(prop),
            writable: false,
            enumerable: false,
            configurable: true,
          }
        }

        throw unregisteredIamTokenError(prop, tokenNames)
      }

      return Reflect.getOwnPropertyDescriptor(target, prop)
    },

    // A callback cannot register a token. `iam.tokens.gcp = '...'` would
    // otherwise mint a placeholder the API was never told about: the egress
    // proxy cannot resolve it, drops the header and forwards the request
    // anyway, which is the silent failure this guard exists to prevent.
    // `Object.defineProperty` walks straight past a `set` trap, so it is
    // refused too, and `delete` is refused because removing a registered name
    // would make the "Registered tokens" list in the error above contradict
    // itself.
    set(_target, prop) {
      throw readOnlyIamTokensError(prop)
    },

    defineProperty(_target, prop) {
      throw readOnlyIamTokensError(prop)
    },

    deleteProperty(_target, prop) {
      throw readOnlyIamTokensError(prop)
    },

    // `name in iam.tokens` answers "is this token registered?", so it must
    // agree with the `get` trap above and not report inherited
    // `Object.prototype` members as tokens. Mirrors Python's
    // `IamTokenPlaceholders.__contains__`.
    has(target, prop) {
      return Object.hasOwn(target, prop)
    },
  })
}
