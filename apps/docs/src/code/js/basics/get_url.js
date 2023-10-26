import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

const url = session.getHostname() // $HighlightLine
console.log('https://' + url)

await session.close()
