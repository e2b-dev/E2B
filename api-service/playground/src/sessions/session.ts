import { Session } from '@devbookhq/sdk'
import NodeCache from 'node-cache'
import { CachedProcess, RunProcessParams } from './process'

export const sessionCache = new NodeCache({
  stdTTL: 60000,
  checkperiod: 5000,
  useClones: false,
  deleteOnExpire: true,
})

sessionCache.on('expired', async function (_, cached: CachedSession) {
  try {
    await cached.delete()
  } catch (err) {
    console.error(err)
  }
})

export class CachedSession {
  private readonly cachedProcesses: CachedProcess[] = []

  private id?: string
  session: Session

  /**
   * You must call `.init()` to start the session.
   * 
   * @param envID 
   */
  constructor(envID: string) {
    this.session = new Session({ id: envID })
  }

  async init() {
    await this.session.open()

    const url = this.session.getHostname()
    if (!url) throw new Error('Cannot start session')

    const [id,] = url.split('.')
    this.id = id
    sessionCache.set(id, this)

    return id
  }

  async delete() {
    if (!this.id) return

    await this.session.close()
    sessionCache.del(this.id)

    this.id = undefined
  }

  async stopProcess(processID: string) {
    await this.findProcess(processID)?.process?.kill()
    const idx = this.cachedProcesses.findIndex(p => p.process?.processID === processID)
    if (idx !== -1) {
      this.cachedProcesses.splice(idx, 1)
    }
  }

  findProcess(processID: string) {
    return this.cachedProcesses.find(p => p.process?.processID === processID)
  }

  async startProcess(params: RunProcessParams) {
    if (!this.session.process) throw new Error('Session is not open')

    const cachedProcess = new CachedProcess(this.session.process)
    await cachedProcess.start(params)
    this.cachedProcesses.push(cachedProcess)

    return cachedProcess
  }

  static findSession(id: string) {
    const cachedSession = sessionCache.get(id) as CachedSession
    if (!cachedSession) throw new Error('Session does not exist')
    return cachedSession
  }
}
