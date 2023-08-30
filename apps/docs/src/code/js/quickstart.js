import { Session } from '@e2b/sdk'

// `id` can also be one of:
// 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
// We're working on custom environments.
const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

await session.close()
