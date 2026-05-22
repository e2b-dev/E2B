import { assert, describe, test } from 'vitest'

import { InvalidArgumentError } from '../../src'
import { getLifecycle } from '../../src/sandbox/sandboxApi'

describe('getLifecycle', () => {
  test('returns defaults when no opts are provided', () => {
    assert.deepEqual(getLifecycle(), {
      onTimeout: 'kill',
      autoResumeEnabled: undefined,
    })
  })

  test('returns defaults when opts is empty', () => {
    assert.deepEqual(getLifecycle({}), {
      onTimeout: 'kill',
      autoResumeEnabled: undefined,
    })
  })

  test('lifecycle.onTimeout takes precedence over autoPause=true', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'kill' }, autoPause: true }),
      {
        onTimeout: 'kill',
        autoResumeEnabled: false,
      }
    )
  })

  test('lifecycle.onTimeout=pause takes precedence over autoPause=false', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause' }, autoPause: false }),
      {
        onTimeout: 'pause',
        autoResumeEnabled: false,
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
      autoResumeEnabled: true,
    })
  })

  test('autoPause=true with no lifecycle maps to onTimeout=pause', () => {
    assert.deepEqual(getLifecycle({ autoPause: true }), {
      onTimeout: 'pause',
      autoResumeEnabled: false,
    })
  })

  test('autoPause=false with no lifecycle maps to onTimeout=kill', () => {
    assert.deepEqual(getLifecycle({ autoPause: false }), {
      onTimeout: 'kill',
      autoResumeEnabled: false,
    })
  })

  test('preserves autoResume from lifecycle', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause', autoResume: true } }),
      {
        onTimeout: 'pause',
        autoResumeEnabled: true,
      }
    )
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause', autoResume: false } }),
      {
        onTimeout: 'pause',
        autoResumeEnabled: false,
      }
    )
  })

  test('autoResume defaults to false when omitted from lifecycle', () => {
    assert.deepEqual(getLifecycle({ lifecycle: { onTimeout: 'pause' } }), {
      onTimeout: 'pause',
      autoResumeEnabled: false,
    })
  })

  test('autoResumeEnabled is undefined when neither lifecycle nor autoPause provided', () => {
    assert.equal(getLifecycle().autoResumeEnabled, undefined)
    assert.equal(getLifecycle({}).autoResumeEnabled, undefined)
  })

  test('autoResumeEnabled is set (false) when only autoPause is provided', () => {
    assert.equal(getLifecycle({ autoPause: true }).autoResumeEnabled, false)
    assert.equal(getLifecycle({ autoPause: false }).autoResumeEnabled, false)
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
