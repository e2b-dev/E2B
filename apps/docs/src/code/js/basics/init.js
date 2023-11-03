import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create()

await sandbox.close()
