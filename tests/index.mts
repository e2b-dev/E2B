import { Sandbox } from 'e2b'

async function createSandbox() {
  return await Sandbox.create({
    timeout: 20000,
    logger: {
      warn: console.warn,
      error: console.error,
    },
  })
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

async function createBatch<T>(length: number, m: () => Promise<T>): Promise<T[]> {
  const sandboxes = Array.from({ length }, m)

  return (await Promise.allSettled(sandboxes))
    .map((result) => {
      if (result.status === 'fulfilled') {
        return result.value
      }

      console.error('ERROR:', result.reason)
    })
    .filter(notEmpty)
}

const batchSize = 5
const batchCount = 10

const sandboxes: Sandbox[] = []

for (let i = 0; i < batchCount; i++) {
  const s = await createBatch(batchSize, createSandbox)
  console.log(`> batch ${i + 1}: ${s.length} sandboxes created`)
  if (s.length > 0) {
    const first = s[0]
    try {
      await first.keepAlive(2 * 60 * 60 * 1000) // 4 hour
    } catch (error) {
      console.error('ERROR:', error)
    }
  }

  sandboxes.push(...s)
}

for (const s of sandboxes) {
  try {
    await s.close()
  } catch (error) {
    console.error('ERROR:', error)
  }
}

console.log('-------------------')
console.log(`> from ${batchCount * batchSize} sandboxes, ${sandboxes.length} were created`)
