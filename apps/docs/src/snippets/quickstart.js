import { Session, Env } from '@e2b/sdk'
const session = await Session.create({ id: 'Nodejs' })

await session.filesystem.write('/hello.txt', 'Hello AI Agents!')