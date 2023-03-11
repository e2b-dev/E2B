import { Session } from '@devbookhq/sdk'
import NodeCache from 'node-cache'

const sessionCache = new NodeCache({
  stdTTL: 60000,
  checkperiod: 5000,
})

export async function initSession(envID: string) {
  const session = new Session({
    id: envID,
  })
  await session.open()
  const url = session.getHostname()
  if (!url) throw new Error('Cannot start session')

  const [id,] = url.split('.')
  sessionCache.set(id, session)
  return id
}

export function retrieveSession(id: string) {
  const session = sessionCache.get(id) as Session | undefined
  if (!session) throw new Error('Session does not exist')

  return session
}

export async function closeSession(id: string) {
  const session = retrieveSession(id)
  if (session) {
    await session.close()
    sessionCache.del(id)
  }
}
