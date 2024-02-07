import { Sandbox } from 'e2b'
import 'dotenv/config'

async function main(){
    const templateID = process.argv[2];

    const sandbox = await Sandbox.create({ id: templateID})
    const result = await sandbox.filesystem.read('/hello.txt')
    console.log(result)
}

main().then(() => process.exit(0))
