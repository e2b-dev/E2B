import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

const npmInit = await session.process.start({
  cmd: 'npm init -y', // $HighlightLine
})
await npmInit.wait()

console.log(npmInit.output.stdout)

await session.close()
