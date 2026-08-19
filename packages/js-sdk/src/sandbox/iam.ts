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
 * await, or coerce to a string. A token is never named after them, so reading
 * one cannot be reported as a missing token — otherwise
 * `JSON.stringify(iam.tokens)` inside a callback would throw.
 */
const RUNTIME_PROBED_PROPS = new Set(['toJSON', 'then', 'toString', 'valueOf'])

/**
 * Value a runtime-probed property resolves to, for a name that is not a
 * registered token.
 *
 * It answers the probe — `JSON.stringify`, `await` and `String()` read these
 * names off any object — while `toPrimitive` decides what a callback that reads
 * the name as a token gets. Coercing the value to a string is the one thing no
 * probe does and every token reference does, so the probe stays silent and the
 * reference is treated like any other unregistered name instead of serializing
 * `undefined` or a built-in's source text.
 *
 * @param prop probed property name.
 * @param target registered placeholders, for the built-ins that read them.
 * @param toPrimitive what the value coerces to.
 */
function runtimeProbeValue(
  prop: string,
  target: Record<string, string>,
  toPrimitive: () => string
): unknown {
  // `then` and `toJSON` are only ever probed with a `typeof … === 'function'`
  // check, so a non-callable value answers the probe: `await` resolves the
  // object as a plain value and `JSON.stringify` falls back to its own keys.
  // `toString` and `valueOf` are called — `String(iam.tokens)` needs one of
  // them to return a primitive — so they keep the built-in behaviour.
  const value =
    prop === 'toString'
      ? () => Object.prototype.toString.call(target)
      : prop === 'valueOf'
        ? () => target
        : {}

  return Object.defineProperty(value, Symbol.toPrimitive, {
    value: toPrimitive,
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

  /**
   * Resolve a name that is not a registered token: its placeholder when names
   * cannot be checked, and otherwise the error the guard exists for.
   */
  const resolveUnregistered = (prop: string): string => {
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

  const readOnly = (action: string, prop: string | symbol): never => {
    throw new InvalidArgumentError(
      `iam.tokens is read-only, cannot ${action} '${String(prop)}'. Registering a workload token is what makes it resolvable, so pass it to Sandbox.create as iam: { tokens: { '${String(prop)}': Secret.iamToken({ audience, tokenType }) } }.`
    )
  }

  return new Proxy(tokens, {
    get(target, prop, receiver) {
      // Own keys only: a bare `in` also matches inherited `Object.prototype`
      // members, so an unregistered token named `constructor` or `__proto__`
      // would resolve to a built-in instead of being reported. Python's
      // mapping treats them as missing too.
      if (typeof prop === 'string' && !Object.hasOwn(target, prop)) {
        if (RUNTIME_PROBED_PROPS.has(prop)) {
          return runtimeProbeValue(prop, target, () =>
            resolveUnregistered(prop)
          )
        }

        return resolveUnregistered(prop)
      }

      return Reflect.get(target, prop, receiver)
    },

    // A descriptor lookup is a token lookup by another spelling, so it resolves
    // like the `get` trap instead of reporting an unregistered name as absent
    // and putting `undefined` on the wire.
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && !Object.hasOwn(target, prop)) {
        return {
          value: RUNTIME_PROBED_PROPS.has(prop)
            ? runtimeProbeValue(prop, target, () => resolveUnregistered(prop))
            : resolveUnregistered(prop),
          writable: false,
          enumerable: false,
          configurable: true,
        }
      }

      return Reflect.getOwnPropertyDescriptor(target, prop)
    },

    // The map is a view of what the request registers: writing a name here
    // registers nothing, it only makes a later read of that name resolve to a
    // placeholder the proxy cannot mint a token for.
    set(_target, prop) {
      return readOnly('assign', prop)
    },

    defineProperty(_target, prop) {
      return readOnly('define', prop)
    },

    deleteProperty(_target, prop) {
      return readOnly('delete', prop)
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
