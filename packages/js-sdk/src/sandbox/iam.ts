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
 * await, or coerce to a string. A callback that mistypes a token name reads
 * them through the very same `get`, so the trap cannot tell a probe from a
 * reference — see {@link runtimeProbeStandIn} for how both are served at once.
 */
const RUNTIME_PROBED_PROPS = ['toJSON', 'then', 'toString', 'valueOf'] as const

type RuntimeProbedProp = (typeof RUNTIME_PROBED_PROPS)[number]

/**
 * Read-only view of workload token placeholders keyed by token name, as exposed
 * to a network `transform` callback.
 */
export type SandboxIamTokenPlaceholders = Readonly<Record<string, string>>

/**
 * Value a lookup of a runtime-probed name that is not a registered token
 * resolves to.
 *
 * The runtime and a callback want different things out of that one read: the
 * runtime only acts on the value when it is callable and never turns it into a
 * string, while a callback that mistook the name for a token interpolates it
 * into a header. The stand-in serves both — it stays inert for the probe, so
 * `await` sees a non-callable `then`, `JSON.stringify` a non-callable `toJSON`
 * and `String(iam.tokens)` a `toString` that behaves like the built-in, and it
 * defers to `resolve` as soon as anything coerces it to a primitive, which is
 * what a token reference does and a probe never does.
 *
 * A bare assignment into a header (`headers: { 'X-Token': iam.tokens.then }`)
 * never coerces; {@link validateTransformHeaders} catches that at the wire.
 */
function runtimeProbeStandIn(
  prop: RuntimeProbedProp,
  resolve: () => string
): unknown {
  // These two have to stay callable, or `String(iam.tokens)` fails with an
  // opaque "Cannot convert object to primitive value" instead of working.
  const standIn =
    prop === 'toString' || prop === 'valueOf'
      ? function (this: unknown) {
          return Object.prototype[prop].call(this)
        }
      : {}

  return Object.defineProperty(standIn, Symbol.toPrimitive, { value: resolve })
}

/** Spell a property key for an error message. */
function describeProp(prop: string | symbol): string {
  return typeof prop === 'string' ? `'${prop}'` : String(prop)
}

/**
 * Guidance for a write that cannot register a token. A name that is already
 * registered gets a different hint — telling the caller to register it again
 * would contradict the sandbox.
 */
function writeHint(
  prop: string | symbol,
  tokens: Record<string, string>
): string {
  if (typeof prop === 'string' && Object.hasOwn(tokens, prop)) {
    return `${describeProp(prop)} is already registered — iam.tokens only exposes its placeholder.`
  }

  return `Register it as iam: { tokens: { ${describeProp(prop)}: Secret.iamToken({ audience, tokenType }) } } instead — a name assigned here resolves to a placeholder the egress proxy has no token for.`
}

/**
 * `iam.tokens` mirrors the tokens the request registers, so writing to it
 * cannot register anything: the name would resolve to a placeholder the egress
 * proxy has no token for, and the request would go out with an unresolved
 * header instead of failing here. Deleting is worse — the guard would keep
 * listing the name as registered while refusing to resolve it.
 */
function readOnlyIamTokensError(
  action: string,
  prop: string | symbol,
  hint: string
): InvalidArgumentError {
  return new InvalidArgumentError(
    `Cannot ${action} iam token ${describeProp(prop)}: iam.tokens is a read-only view of the tokens the sandbox registers. ${hint}`
  )
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
 * an error here. That holds for the names the runtime probes too — see
 * {@link runtimeProbeStandIn} — and the view is read-only, because a name added
 * or removed here would only make the guard lie about what the sandbox
 * registered. Assigning or deleting throws {@link InvalidArgumentError}.
 *
 * `validate: false` is for the update-network endpoint, whose payload carries no
 * `iam` config — the sandbox's registered token names are not known client-side
 * there, so any name resolves to its placeholder.
 */
export function iamTokenPlaceholders(
  tokenNames: string[],
  { validate }: { validate: boolean }
): SandboxIamTokenPlaceholders {
  const tokens: Record<string, string> = {}
  for (const name of tokenNames) {
    tokens[name] = iamTokenPlaceholder(name)
  }

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

  const standIns = new Map<string, unknown>(
    RUNTIME_PROBED_PROPS.map((prop) => [
      prop,
      runtimeProbeStandIn(prop, () => resolveUnregistered(prop)),
    ])
  )

  /** The value the name `prop` resolves to, however it is read. */
  const resolve = (prop: string): unknown => {
    // Own keys only: a bare `in` also matches inherited `Object.prototype`
    // members, so an unregistered token named `constructor` or `__proto__`
    // would resolve to a built-in instead of being reported. Python's mapping
    // treats them as missing too.
    if (Object.hasOwn(tokens, prop)) {
      return tokens[prop]
    }

    return standIns.get(prop) ?? resolveUnregistered(prop)
  }

  return new Proxy(tokens, {
    get(target, prop, receiver) {
      return typeof prop === 'string'
        ? resolve(prop)
        : Reflect.get(target, prop, receiver)
    },

    // Own-property membership must agree with `has` and `ownKeys`: only
    // registered names are owned. Returning a descriptor for an unregistered
    // name made `Object.hasOwn(iam.tokens, 'gcp')` throw (or report true under
    // `validate: false`) instead of answering like `'gcp' in iam.tokens`.
    // Putting an unregistered name in a header without coercing it is caught
    // when the transform is validated for the wire.
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },

    // `name in iam.tokens` answers "is this token registered?", so it must
    // agree with the `get` trap above and not report inherited
    // `Object.prototype` members as tokens. Mirrors Python's
    // `IamTokenPlaceholders.__contains__`.
    has(target, prop) {
      return Object.hasOwn(target, prop)
    },

    set(_target, prop) {
      throw readOnlyIamTokensError('assign', prop, writeHint(prop, tokens))
    },

    defineProperty(target, prop, descriptor) {
      // `Object.freeze` / `Object.seal` redefine each own property in place.
      // Allow that when the value is unchanged — the trap's job is rejecting a
      // name the sandbox never registered, not breaking freeze on a view that
      // is already read-only.
      if (
        typeof prop === 'string' &&
        Object.hasOwn(target, prop) &&
        'value' in descriptor &&
        descriptor.value === target[prop]
      ) {
        return Reflect.defineProperty(target, prop, descriptor)
      }

      throw readOnlyIamTokensError('define', prop, writeHint(prop, tokens))
    },

    deleteProperty(_target, prop) {
      throw readOnlyIamTokensError(
        'delete',
        prop,
        "Drop it from Sandbox.create's iam config instead."
      )
    },
  })
}
