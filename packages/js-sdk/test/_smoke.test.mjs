import { Session } from '../src'
import { expect, test } from 'vitest'
import { id } from './setup.mjs'

// Smoke test = quick, high-level, basic functionality test
test.skip('Smoke test', async () => {
    const session = await Session.create({ id })
    await session.filesystem.makeDir('/test/new')

    const ls = await session.filesystem.list('/test')
    expect(ls.map(x => x.name)).toEqual(['new'])

    await session.close()
})
