import { config } from 'dotenv'

import { Sandbox } from './dist'

function log(...args: any[]) {
  console.log(...args)
}

config()

const sbx = await Sandbox.create('bwyvo5fk343pbvxst536')
log('ℹ️ sandbox created', sbx.sandboxId)

await sbx.runCode('x = 1')
log('Sandbox code executed')

const sandboxId = await sbx.betaPause()
log('Sandbox paused', sandboxId)

// Resume the sandbox from the same state
const sameSbx = await Sandbox.connect(sbx.sandboxId)
log('Sandbox resumed', sameSbx.sandboxId)

const execution = await sameSbx.runCode('x+=1; x')
// Output result
log(execution.text)
log(execution.error)
if (execution.text !== '2') {
  log('Test failed:', 'Failed to resume sandbox')
  throw new Error('Failed to resume sandbox')
}
log('Sandbox resumed successfully')

await sbx.kill()
log('Sandbox deleted')
