import { Sandbox } from 'e2b'
import 'dotenv/config'

async function main(){
    const sandbox = await Sandbox.create({ id: 'e2etesting'})
    const result = await sandbox.filesystem.read('/hello.txt')
    console.log(result)
}

main().then(() => process.exit(0))
