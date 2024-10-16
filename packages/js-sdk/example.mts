import { Sandbox } from './dist'

import dotenv from 'dotenv'

dotenv.config()

for (let i = 0; i < 10; i++) {
  const start = Date.now()
  const sbx = await Sandbox.create({ timeoutMs: 10000 })
  console.log('time', Date.now() - start)
}
