import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

const openPort = 3000
const url = session.getHostname(openPort) // $HighlightLine
console.log('https://' + url)

await session.close()
