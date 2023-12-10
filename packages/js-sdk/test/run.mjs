import { Sandbox } from '../dist/index.js'

const sandbox = await Sandbox.create({
  apiKey: process.env.E2B_API_KEY
  // __debug_hostname: 'localhost',
  // __debug_port: 49982,
  // __debug_devEnv: 'local',
})

await sandbox.close()
