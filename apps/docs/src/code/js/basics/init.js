import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs', // or 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
})

await session.close()
