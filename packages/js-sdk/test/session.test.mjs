import { Session } from '../src'
import { test, expect } from 'vitest'


test('create session', async () => {
  const session = await Session.create({id: 'Nodejs'})
  await session.close()
})


test('create multiple sessions', async () => {
  const session = await Session.create({id: 'Nodejs'})
  const session2 = await Session.create({id: 'Nodejs'})
  await session.close()
  await session2.close()
}, 10000)

test(
  'custom cwd',
  async () => {
    const session = await Session.create({
      id: 'Nodejs',
      cwd: '/code/app',
    })

    {
      const proc = await session.process.start({ cmd: 'pwd' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('/code/app')
    }

    // filesystem ops does not respect the cwd yet
    {
      await session.filesystem.write('hello.txt', `Hello VM!`)
      const proc = await session.process.start({ cmd: 'cat /hello.txt' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('Hello VM!')
    }

    // change dir to /home/user
    {
      const proc = await session.process.start({ cmd: 'cd /home/user' })
      await proc.finished
    }

    // create another file, it should still be in root
    {
      await session.filesystem.write('hello2.txt', `Hello VM 2!`)
      const proc = await session.process.start({ cmd: 'cat /hello2.txt' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('Hello VM 2!')
    }
  },
  { timeout: 10_000 },
)
