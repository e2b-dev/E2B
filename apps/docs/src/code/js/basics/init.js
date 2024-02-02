import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create()

await sandbox.close()
