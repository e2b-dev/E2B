import { Sandbox } from './dist'

import dotenv from 'dotenv'

dotenv.config()

const start = Date.now()
console.log('creating sandbox')
const sbx = await Sandbox.create('k1urqpinffy6bcost93w', { timeoutMs: 10000 })
console.log('sandbox created', Date.now() - start)
console.log(sbx.sandboxId)

await sbx.files.write('/home/user/test.txt', 'hello')

const startPausing = Date.now()
console.log('pausing sandbox')
await sbx.pause()
console.log('sandbox paused', Date.now() - startPausing)

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

await wait(20_000)

console.log(sbx.sandboxId)

// console.log('killing sandbox')
// await sbx.kill()
// console.log('sandbox killed')

const resumeStart = Date.now()
console.log('resuming sandbox')
const resumed = await Sandbox.resume(sbx.sandboxId, { timeoutMs: 10000 })
console.log('sandbox resumed', Date.now() - resumeStart)

const content = await resumed.files.read('/home/user/test.txt')
console.log('content', content)

const running = await resumed.isRunning()
console.log('sandbox running', running)



// console.log(sbx.sandboxId)
