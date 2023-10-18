import { Session } from '../src'
import { expect, test } from 'vitest'

// Smoke test = quick, high-level, basic functionality test
test.skip('Smoke test', async () => {
    const session = await Session.create({ id: 'Nodejs' })
    await session.filesystem.makeDir('/test/new')

    const ls = await session.filesystem.list('/test')
    expect(ls.map(x => x.name)).toEqual(['new'])

    await session.close()
})
