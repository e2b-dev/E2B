import { config } from 'dotenv'

import { Sandbox } from './dist'

config()

const sandbox = await Sandbox.create({
  logger: {
    error: console.error,
    warn: console.warn,
    info: console.info,
  },
})
console.log(sandbox.id)

await sandbox


await sandbox.close()
