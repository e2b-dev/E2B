import { assert } from 'vitest'

import { Sandbox, Volume } from '../../src'
import { hostedTest, template } from '../setup'

/**
 * Volume content persisting across sandboxes is server-side behavior — the
 * mount happens on real compute, so this is the one volume test that can't be
 * mocked. Everything else about volumes (CRUD, pagination, error mapping, the
 * content API) is asserted against a mocked transport in the unit tier.
 */
hostedTest('a mounted volume persists content across sandboxes', async () => {
  const volume = await Volume.create(`test-mount-${Date.now()}`)

  try {
    const writer = await Sandbox.create(template, {
      volumeMounts: { '/mnt/data': volume },
    })
    try {
      await writer.files.write('/mnt/data/hello.txt', 'written by the writer')
    } finally {
      await writer.kill()
    }

    const reader = await Sandbox.create(template, {
      volumeMounts: { '/mnt/data': volume },
    })
    try {
      assert.equal(
        await reader.files.read('/mnt/data/hello.txt'),
        'written by the writer'
      )
    } finally {
      await reader.kill()
    }
  } finally {
    await Volume.destroy(volume.volumeId)
  }
})
