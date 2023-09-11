import { Session } from '@e2b/sdk'

const session = await Session.create({
  // We're working on custom environments
  id: 'Nodejs', // or 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  apiKey: process.env.E2B_API_KEY,
})

await session.close()
