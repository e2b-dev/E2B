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

  test('passes through lifecycle.onTimeout=kill', () => {
    assert.deepEqual(getLifecycle({ lifecycle: { onTimeout: 'kill' } }), {
      onTimeout: 'kill',
      autoResume: undefined,
    })
  })

  test('passes through lifecycle.onTimeout=pause', () => {
    assert.deepEqual(getLifecycle({ lifecycle: { onTimeout: 'pause' } }), {
      onTimeout: 'pause',
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

  test('throws when autoResume=true and onTimeout=kill', () => {
    assert.throws(
      () =>
        getLifecycle({
          lifecycle: { onTimeout: 'kill', autoResume: true },
        }),
      InvalidArgumentError
    )
  })

  test('does not throw when autoResume=true and onTimeout=pause', () => {
    assert.doesNotThrow(() =>
      getLifecycle({
        lifecycle: { onTimeout: 'pause', autoResume: true },
      })
    )
  })

  test('does not throw when autoResume=false and onTimeout=kill', () => {
    assert.doesNotThrow(() =>
      getLifecycle({
        lifecycle: { onTimeout: 'kill', autoResume: false },
      })
    )
  })
})
