import { assert, test } from 'vitest'

import E2B, { Sandbox, Secret, Volume } from '../src'

test('client exposes bound subclasses', () => {
  const client = new E2B({ apiKey: 'client-key' })

  assert.isTrue(client.Sandbox.prototype instanceof Sandbox)
  assert.isTrue(client.Volume.prototype instanceof Volume)
  assert.strictEqual(client.Secret, Secret)
  assert.isFunction(client.Template)
  assert.isFunction(client.Template.build)
})

test('client defaults are merged below per-call options', () => {
  const client = new E2B({ apiKey: 'client-key', domain: 'client.example' })

  const merged = (client.Sandbox as any).withDefaults({})
  assert.equal(merged.apiKey, 'client-key')
  assert.equal(merged.domain, 'client.example')

  const overridden = (client.Sandbox as any).withDefaults({
    apiKey: 'call-key',
  })
  assert.equal(overridden.apiKey, 'call-key')
  assert.equal(overridden.domain, 'client.example')
})

test('clients are independent', () => {
  const clientA = new E2B({ apiKey: 'key-a' })
  const clientB = new E2B({ apiKey: 'key-b', apiUrl: 'https://api.b.example' })

  assert.deepEqual((clientA.Sandbox as any).withDefaults({}), {
    apiKey: 'key-a',
  })
  assert.deepEqual((clientB.Sandbox as any).withDefaults({}), {
    apiKey: 'key-b',
    apiUrl: 'https://api.b.example',
  })
  assert.deepEqual((clientA.Volume as any).withDefaults({}), {
    apiKey: 'key-a',
  })
})

test('top-level classes have no client defaults', () => {
  new E2B({ apiKey: 'client-key' })

  assert.deepEqual((Sandbox as any).withDefaults({}), {})
  assert.deepEqual((Volume as any).withDefaults({}), {})
})
