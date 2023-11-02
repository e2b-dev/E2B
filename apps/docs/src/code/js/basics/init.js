import {Sandbox} from '@e2b/sdk'

const sandbox = await Sandbox.create({
  id: 'base', // or you can pass your own sandbox template id
})

await sandbox.close()
