import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({ apiKey: 'YOUR_API_KEY' })
await sandbox.close()
