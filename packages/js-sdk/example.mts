import { Sandbox } from './dist'
import { configDotenv } from 'dotenv'

configDotenv()

const sandbox = await Sandbox.create()

console.log('Sandbox created:', sandbox.sandboxId)

await sandbox.kill()
console.log('Sandbox killed')
