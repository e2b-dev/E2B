import { expect, test } from 'vitest'
import { Sandbox } from '../src'

test('list running sandboxes', async () => {
  const sandboxPromises = []
  for (let i = 0; i < 3; i++) {
    sandboxPromises.push(Sandbox.create({
      id: 'base',
      apiKey: process.env.E2B_API_KEY,
      metadata: { n: `js${i}` }
    }))
  }
  const sandboxes = await Promise.all(sandboxPromises)

  const running = (await Sandbox.list()).filter(s => s.metadata?.n?.startsWith('js'))
  expect(running.length).toEqual(3)
  expect(new Set(running.map(s => s.metadata['n']))).toEqual(new Set(['js0', 'js1', 'js2']))

  for (const sandbox of sandboxes) {
    await sandbox.close()
  }
})
