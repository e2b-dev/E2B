import { Session } from '../src'
import { expect, test } from 'vitest'

const E2B_API_KEY = process.env.E2B_API_KEY

test('create session', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })
  await session.close()
})

test('create multiple sessions', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })
  const session2 = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })
  await session.close()
  await session2.close()
}, 10000)

test(
  'custom cwd',
  async () => {
    const session = await Session.create({
      id: 'Nodejs',
      apiKey: E2B_API_KEY,
      cwd: '/code/app',
    })

    {
      const proc = await session.process.start({ cmd: 'pwd' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('/code/app')
    }

    {
      await session.filesystem.write('hello.txt', `Hello VM!`)
      const proc = await session.process.start({ cmd: 'readlink -f hello.txt' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('/code/app/hello.txt')
    }

    // change dir to /home/user
    {
      const proc = await session.process.start({ cmd: 'cd /home/user' })
      await proc.finished
    }

    // create another file, it should still respect the session cwd and not the cd from previous step
    {
      await session.filesystem.write('hello2.txt', `Hello VM!`)
      const proc = await session.process.start({ cmd: 'readlink -f hello2.txt' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('/code/app/hello2.txt')
    }
  },
  { timeout: 10_000 },
)
