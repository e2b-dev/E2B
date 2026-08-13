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
 * Properties the language and the runtime read off any object they serialize,
 * await, or coerce to a string. A token is never named after them, so they
 * resolve normally instead of counting as a token reference — otherwise
 * `JSON.stringify(iam.tokens)` inside a callback would throw.
 */
const RUNTIME_PROBED_PROPS = new Set(['toJSON', 'then', 'toString', 'valueOf'])

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
      if (
        typeof prop === 'string' &&
        // Own keys only: a bare `in` also matches inherited `Object.prototype`
        // members, so an unregistered token named `constructor` or `__proto__`
        // would resolve to a built-in instead of being reported. Python's
        // mapping treats them as missing too.
        !Object.hasOwn(target, prop) &&
        !RUNTIME_PROBED_PROPS.has(prop)
      ) {
        if (!validate) {
          return iamTokenPlaceholder(prop)
        }

        const hint =
          tokenNames.length === 0
            ? `Pass it to Sandbox.create as iam: { tokens: { '${prop}': Secret.iamToken({ audience, tokenType }) } }.`
            : `Registered tokens: ${tokenNames.map((name) => `'${name}'`).join(', ')}.`

        throw new InvalidArgumentError(
          `Network transform references iam token '${prop}', which is not registered. ${hint}`
        )
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
}
