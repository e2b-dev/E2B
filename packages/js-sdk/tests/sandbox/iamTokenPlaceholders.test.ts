import { describe, expect, test } from 'vitest'

import { iamTokenPlaceholders } from '../../src/sandbox/iam'
import { InvalidArgumentError } from '../../src/errors'

const registered = () => iamTokenPlaceholders(['aws'], { validate: true })

// The names the runtime reads off any object it serializes, awaits or coerces.
const probedNames = ['toJSON', 'then', 'toString', 'valueOf'] as const

describe('a registered token', () => {
  test('resolves to its placeholder', () => {
    expect(registered().aws).toBe('${e2b.identity.tokens.aws}')
  })

  test('is the only thing the object reports owning', () => {
    const tokens = registered()

    expect(Object.keys(tokens)).toEqual(['aws'])
    expect({ ...tokens }).toEqual({ aws: '${e2b.identity.tokens.aws}' })
    expect('aws' in tokens).toBe(true)
    expect('gcp' in tokens).toBe(false)
    // Membership checks must agree with `in` and `Object.keys` — they used to
    // throw (or report every name under validate: false) via getOwnPropertyDescriptor.
    expect(Object.hasOwn(tokens, 'aws')).toBe(true)
    expect(Object.hasOwn(tokens, 'gcp')).toBe(false)
    expect(Object.getOwnPropertyDescriptor(tokens, 'aws')?.value).toBe(
      '${e2b.identity.tokens.aws}'
    )
    expect(Object.getOwnPropertyDescriptor(tokens, 'gcp')).toBeUndefined()
  })
})

describe('an unregistered token', () => {
  test('is rejected when read as a property', () => {
    expect(() => `Bearer ${registered().gpc}`).toThrowError(
      /iam token 'gpc', which is not registered. Registered tokens: 'aws'/
    )
  })

  test.for(probedNames)(
    'named %s is rejected like any other name',
    (name: (typeof probedNames)[number]) => {
      // The runtime probes these four, so the guard used to wave them through
      // and serialize `undefined` or a built-in function into the header.
      expect(() => `Bearer ${registered()[name]}`).toThrowError(
        `iam token '${name}', which is not registered`
      )
    }
  )
})

describe('the runtime', () => {
  test('can serialize the object', () => {
    expect(JSON.stringify(registered())).toBe(
      JSON.stringify({ aws: '${e2b.identity.tokens.aws}' })
    )
  })

  test('can coerce the object to a string', () => {
    expect(String(registered())).toBe('[object Object]')
    expect(`${registered()}`).toBe('[object Object]')
  })

  test('does not mistake the object for a promise', async () => {
    const tokens = registered()

    expect(typeof tokens.then).not.toBe('function')
    await expect(Promise.resolve(tokens)).resolves.toBe(tokens)
  })
})

describe('the object is read-only', () => {
  // Registering a name here cannot make the proxy mint a token for it, so the
  // request would go out with a placeholder the egress proxy drops.
  test('rejects an assignment', () => {
    expect(() => {
      // Readonly at the type level; the trap still has to refuse at runtime.
      ;(registered() as { gcp?: string }).gcp = '${e2b.identity.tokens.gcp}'
    }).toThrowError(
      /Cannot assign iam token 'gcp'.*Register it as iam: \{ tokens: \{ 'gcp'/s
    )
  })

  test('rejects assigning a registered name without telling the caller to re-register it', () => {
    expect(() => {
      ;(registered() as { aws: string }).aws = 'x'
    }).toThrowError(
      /Cannot assign iam token 'aws'.*already registered — iam\.tokens only exposes its placeholder/s
    )
  })

  test('rejects a defineProperty that changes a value', () => {
    expect(() =>
      Object.defineProperty(registered(), 'gcp', { value: 'anything' })
    ).toThrowError(/Cannot define iam token 'gcp'/)
  })

  test('allows freeze and seal on registered names', () => {
    const frozen = registered()
    expect(() => Object.freeze(frozen)).not.toThrow()
    expect(Object.isFrozen(frozen)).toBe(true)
    expect(frozen.aws).toBe('${e2b.identity.tokens.aws}')

    const sealed = registered()
    expect(() => Object.seal(sealed)).not.toThrow()
    expect(Object.isSealed(sealed)).toBe(true)
  })

  // Deleting used to leave the guard contradicting itself: reading 'aws' back
  // reported it as unregistered while listing it as a registered token.
  test('rejects a delete', () => {
    const tokens = registered()

    expect(() => {
      delete (tokens as { aws?: string }).aws
    }).toThrowError(/Cannot delete iam token 'aws'/)
    expect(tokens.aws).toBe('${e2b.identity.tokens.aws}')
  })
})

describe('without a known set of registered tokens', () => {
  const unvalidated = () => iamTokenPlaceholders([], { validate: false })

  test('any name resolves to its placeholder', () => {
    expect(unvalidated().aws).toBe('${e2b.identity.tokens.aws}')
  })

  test('still reports owning only the registered names', () => {
    // validate: false resolves any name on read, but membership must not claim
    // every string is an own property — that used to break Object.hasOwn.
    expect(Object.hasOwn(unvalidated(), 'aws')).toBe(false)
    expect(Object.keys(unvalidated())).toEqual([])
  })

  test.for(probedNames)(
    'a token named %s resolves to its placeholder too',
    (name: (typeof probedNames)[number]) => {
      expect(`${unvalidated()[name]}`).toBe(`\${e2b.identity.tokens.${name}}`)
    }
  )

  test('the runtime can still serialize and coerce the object', () => {
    expect(JSON.stringify(unvalidated())).toBe('{}')
    expect(String(unvalidated())).toBe('[object Object]')
  })
})
