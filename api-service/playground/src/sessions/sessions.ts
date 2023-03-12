import { OutStderrResponse, OutStdoutResponse, Process, Session } from '@devbookhq/sdk'
import NodeCache from 'node-cache'

export const sessionCache = new NodeCache({
  stdTTL: 60000,
  checkperiod: 5000,
  useClones: false,
  deleteOnExpire: true,
})

interface CachedProcess {
  process: Process
  stdout: OutStdoutResponse[]
  stderr: OutStderrResponse[]
}

interface CacheEntry {
  session: Session
  processes?: CachedProcess[]
}

sessionCache.on('del', async function (_, entry: CacheEntry) {
  try {
    await entry.session.close()
  } catch (err) {
    console.error(err)
  }
})

export async function initSession(envID: string) {
  const session = new Session({
    id: envID,
  })
  await session.open()
  const url = session.getHostname()
  if (!url) throw new Error('Cannot start session')

  const [id,] = url.split('.')

  const entry: CacheEntry = {
    session,
  }

  sessionCache.set(id, entry)
  return id
}

export function retrieveEntry(id: string) {
  const entry = sessionCache.get(id) as CacheEntry | undefined
  if (!entry) throw new Error('Session does not exist')

  return entry
}

export async function closeSession(id: string) {
  const entry = retrieveEntry(id)
  if (entry) {
    await entry.session.close()
    sessionCache.del(id)
  }
}
