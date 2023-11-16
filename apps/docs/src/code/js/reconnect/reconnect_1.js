import { Sandbox } from '@e2b/sdk'

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const sandbox = await Sandbox.create({id: 'base'})