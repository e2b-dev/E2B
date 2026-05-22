import { assert, describe, test } from 'vitest'

import { getLifecycle } from '../../src/sandbox/sandboxApi'

describe('getLifecycle', () => {
  test('returns defaults when no opts are provided', () => {
    assert.deepEqual(getLifecycle(), {
      autoResume: false,
      onTimeout: 'kill',
    })
  })

  test('returns defaults when opts is empty', () => {
    assert.deepEqual(getLifecycle({}), {
      autoResume: false,
      onTimeout: 'kill',
    })
  })

  test('lifecycle.onTimeout takes precedence over autoPause=true', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'kill' }, autoPause: true }),
      {
        autoResume: false,
        onTimeout: 'kill',
      }
    )
  })

  test('lifecycle.onTimeout=pause takes precedence over autoPause=false', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause' }, autoPause: false }),
      {
        autoResume: false,
        onTimeout: 'pause',
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
      autoResume: true,
      onTimeout: 'pause',
    })
    assert.deepEqual(getLifecycle({ lifecycle, autoPause: false }), {
      autoResume: true,
      onTimeout: 'kill',
    })
  })

  test('autoPause=true with no lifecycle maps to onTimeout=pause', () => {
    assert.deepEqual(getLifecycle({ autoPause: true }), {
      autoResume: false,
      onTimeout: 'pause',
    })
  })

  test('autoPause=false with no lifecycle maps to onTimeout=kill', () => {
    assert.deepEqual(getLifecycle({ autoPause: false }), {
      autoResume: false,
      onTimeout: 'kill',
    })
  })

  test('preserves autoResume from lifecycle', () => {
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause', autoResume: true } }),
      {
        autoResume: true,
        onTimeout: 'pause',
      }
    )
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'pause', autoResume: false } }),
      {
        autoResume: false,
        onTimeout: 'pause',
      }
    )
  })

  test('autoResume defaults to false when omitted from lifecycle', () => {
    assert.deepEqual(getLifecycle({ lifecycle: { onTimeout: 'pause' } }), {
      autoResume: false,
      onTimeout: 'pause',
    })
  })

  test('autoResume is independent of onTimeout (decoupled from auto-pause)', () => {
    // Per design: autoResume can be set even when onTimeout is 'kill'.
    assert.deepEqual(
      getLifecycle({ lifecycle: { onTimeout: 'kill', autoResume: true } }),
      {
        autoResume: true,
        onTimeout: 'kill',
      }
    )
  })
})
