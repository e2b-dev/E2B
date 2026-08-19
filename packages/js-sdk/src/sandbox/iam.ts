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
  * header value at all, so the API would answer with an opaque 400.
 */
const INVALID_IAM_TOKEN_NAME_CHARS = /[{}\p{Cc}]/u

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
  * `iam` config, since the sandbox's registered token names are not known client-side
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

  const tokensWithRuntimeProps = tokens as Record<string, string | (() => unknown)>

  let proxy: Record<string, string | (() => unknown)>
  const unregistered = (name: string): never => {
    const hint =
      tokenNames.length === 0
        ? `Pass it to Sandbox.create as iam: { tokens: { '${name}': Secret.iamToken({ audience, tokenType }) } }.`
        : `Registered tokens: ${tokenNames.map((n) => `'${n}'`).join(', ')}.`

    throw new InvalidArgumentError(
      `Network transform references iam token '${name}', which is not registered. ${hint}`
    )
  }

  // The runtime reads `toJSON`, `toString` and `valueOf` off the object to
  // serialize / coerce it (`JSON.stringify(iam.tokens)`, `String(iam.tokens)`).
  // Those reads are indistinguishable from a user's name lookup, so the
  // methods are guarded: calling them as methods of the proxy keeps the
  // runtime path working, but coercing the read value itself, the typo
  // `` `Bearer ${iam.tokens.toString}` ``, raises like any other
  // unregistered name.
  const guardedRuntimeMethod = (name: string) => {
    const method = function (this: unknown) {
      if (this === proxy) {
        if (name === 'toJSON') {
          const result: Record<string, string> = {}
          for (const key of Object.keys(tokens)) {
            result[key] = tokens[key]
          }
          return result
        }
        return 'iam.tokens'
      }
      unregistered(name)
    }
    // Coercing the method itself must raise instead of emitting source text.
    Object.defineProperty(method, 'toString', {
      value: () => unregistered(name),
    })
    Object.defineProperty(method, Symbol.toPrimitive, {
      value: () => unregistered(name),
    })
    return method
  }

  // `then` is never needed for serialization and must behave like any other
  // unregistered name on read; `toJSON`/`toString`/`valueOf` are installed as
  // non-enumerable own methods so the runtime path works. A registered token
  // can legitimately be named after one of these props, and in that case the
  // registered placeholder wins: skip the guard so `iam.tokens[name]` still
  // resolves to the placeholder and stays enumerable for serialization.
  for (const name of ['toJSON', 'toString', 'valueOf'] as const) {
    if (Object.hasOwn(tokens, name)) continue

    const method = guardedRuntimeMethod(name)
    Object.defineProperty(tokensWithRuntimeProps, name, {
      value: method,
      enumerable: false,
      configurable: false,
      writable: false,
    })
  }

  proxy = new Proxy(tokensWithRuntimeProps, {
    get(target, prop, receiver) {
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
        unregistered(prop)
      }

      return Reflect.get(target, prop, receiver)
    },

    // `name in iam.tokens` answers "is this token registered?", so it must
    // agree with the `get` trap above and not report inherited
    // `Object.prototype` members as tokens. Mirrors Python's
    // `IamTokenPlaceholders.__contains__`.
    has(target, prop) {
      return Object.hasOwn(target, prop)
    },
  })

  // The runtime methods live on the proxy but are never exposed as token
  // placeholders, so the public shape stays `Record<string, string>`.
  return proxy as unknown as Record<string, string>
}
