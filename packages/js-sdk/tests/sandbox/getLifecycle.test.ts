import { assert, describe, test } from 'vitest'

import { InvalidArgumentError } from '../../src'
import { getLifecycle } from '../../src/sandbox/sandboxApi'

describe('getLifecycle', () => {
  test('returns defaults when no opts are provided', () => {
    assert.deepEqual(getLifecycle(), {
      onTimeout: 'kill',
      autoResume: undefined,
    })
  })

  test('returns defaults when opts is empty', () => {
    assert.deepEqual(getLifecycle({}), {
      onTimeout: 'kill',
      autoResume: undefined,
    })
  })

  test('lifecycle.onTimeout takes precedence over autoPause=true', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'kill' }, autoPause: true }),
      {
        onTimeout: 'kill',
        autoResume: undefined,
      }
    )
  })

  test('lifecycle.onTimeout=pause takes precedence over autoPause=false', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause' }, autoPause: false }),
      {
        onTimeout: 'pause',
        autoResume: undefined,
      }
    )
  })

  test('falls back to autoPause when lifecycle.onTimeout is missing', () => {
    // partial lifecycle without onTimeout (possible at runtime despite TS typing)
    const lifecycle = { autoResume: true } as unknown as {
      onTimeout: 'pause' | 'kill'
      autoResume?: boolean
    }
    assert.deepEqual(getLifecycle({ lifecycle, autoPause: true }), {
      onTimeout: 'pause',
      autoResume: true,
    })
  })

  test('autoPause=true with no lifecycle maps to onTimeout=pause', () => {
    assert.deepEqual(getLifecycle({ autoPause: true }), {
      onTimeout: 'pause',
      autoResume: undefined,
    })
  })

  test('autoPause=false with no lifecycle maps to onTimeout=kill', () => {
    assert.deepEqual(getLifecycle({ autoPause: false }), {
      onTimeout: 'kill',
      autoResume: undefined,
    })
  })

  test('preserves autoResume from lifecycle', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause', autoResume: true } }),
      {
        onTimeout: 'pause',
        autoResume: true,
      }
    )
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause', autoResume: false } }),
      {
        onTimeout: 'pause',
        autoResume: false,
      }
    )
  })

  test('autoResume is undefined when omitted from lifecycle', () => {
    assert.deepEqual(getLifecycle({ lifecycle: { onTimeout: 'pause' } }), {
      onTimeout: 'pause',
      autoResume: undefined,
    })
  })

  test('autoResume is undefined when only autoPause is provided', () => {
    assert.equal(getLifecycle({ autoPause: true }).autoResume, undefined)
    assert.equal(getLifecycle({ autoPause: false }).autoResume, undefined)
  })

  test('throws when autoResume=true and onTimeout=kill', () => {
    assert.throws(
      () =>
        getLifecycle({
          lifecycle: { onTimeout: 'kill', autoResume: true },
        }),
      InvalidArgumentError
    )
  })

  test('throws when autoResume=true and effective onTimeout resolves to kill', () => {
    // partial lifecycle with autoResume=true; no onTimeout; autoPause falsy.
    const lifecycle = { autoResume: true } as unknown as {
      onTimeout: 'pause' | 'kill'
      autoResume?: boolean
    }
    assert.throws(() => getLifecycle({ lifecycle }), InvalidArgumentError)
    assert.throws(
      () => getLifecycle({ lifecycle, autoPause: false }),
      InvalidArgumentError
    )
  })

  test('does not throw when autoResume=true and autoPause=true (no explicit onTimeout)', () => {
    const lifecycle = { autoResume: true } as unknown as {
      onTimeout: 'pause' | 'kill'
      autoResume?: boolean
    }
    assert.doesNotThrow(() => getLifecycle({ lifecycle, autoPause: true }))
  })
})
