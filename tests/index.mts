import { Sandbox } from 'e2b'
import { config } from 'dotenv'
config()

const p = `
import time

print('start')

for i in range(10):
    print(i)
    time.sleep(1)

print('end')


import requests

url = 'https://www.google.com/'

response = requests.get(url)

if response.status_code == 200:
    with open('google.html', 'w', encoding='utf-8') as file:
        file.write(response.text)
    print('Website downloaded successfully.')
else:
    print(f'Failed to download website. Status code: {response.status_code}')

`

async function createSandbox() {
  const sandbox = await Sandbox.create({
    timeout: 20000,
    logger: {
      warn: console.warn,
      error: console.error,
    },
  })

  const out = await sandbox.process.startAndWait('pip install requests')
  console.log('OUT1:', out)
  const o2 = await sandbox.process.startAndWait(`python3 -c "${p}"`)
  console.log('OUT2:', o2)

  return sandbox
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

const batchSize = 1
const batchCount = 1

const sandboxes: Sandbox[] = []

for (let i = 0; i < batchCount; i++) {
  const s = await createBatch(batchSize, createSandbox)
  console.log(`> batch ${i + 1}: ${s.length} sandboxes created`)
  if (s.length > 0) {
    const first = s[0]
    try {
      await first.keepAlive(60 * 60 * 1000) // 4 hour
      // Remove the first element
    } catch (error) {
      console.error('ERROR:', error)
    }
  }

  sandboxes.push(...s)
}

for (const s of sandboxes) {
  try {
    s.close()

    // Randomly kill some sandboxes
    if (Math.random() > 0.5) {
      await Sandbox.kill(s.id)
      continue
    }
  } catch (error) {
    console.error('ERROR:', error)
  }
}


console.log('-------------------')
console.log(`> from ${batchCount * batchSize} sandboxes, ${sandboxes.length} were created`)

process.exit(0)