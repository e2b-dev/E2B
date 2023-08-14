import { OpenedPort as OpenPort, Session } from '@devbookhq/sdk'
import NodeCache from 'node-cache'

import { CachedProcess, RunProcessParams } from './process'

export const sessionCache = new NodeCache({
  stdTTL: 7200,
  checkperiod: 200,
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

  private closed = false

  ports: OpenPort[] = []

  id?: string
  session: Session

  /**
   * You must call `.init()` to start the session.
   * 
   * @param envID 
   */
  constructor(envID: string) {
    this.session = new Session({
      id: envID,
      onClose: () => {
        this.delete()
      },
      codeSnippet: {
        onScanPorts: (ports) => {
          // We need to remap the ports because there is a lot of hidden properties
          // that breaks the generated API between client and server.
          this.ports = ports.map(p => ({
            Ip: p.Ip,
            Port: p.Port,
            State: p.State,
          }))
        },
      },
    })
  }

  async init() {
    await this.session.open()

    const url = this.session.getHostname()
    if (!url) throw new Error('Cannot start session')

    const [id] = url.split('.')
    this.id = id
    sessionCache.set(id, this)

    return this
  }

  async delete() {
    if (!this.id) return
    if (this.closed) return
    this.closed = true

    await this.session.close()
    sessionCache.del(this.id)
  }

  async stopProcess(processID: string) {
    const cachedProcess = this.findProcess(processID)
    if (!cachedProcess) return

    await cachedProcess.process?.kill()
    const idx = this.cachedProcesses.findIndex(p => p.process?.processID === processID)
    if (idx !== -1) {
      this.cachedProcesses.splice(idx, 1)
    }

    return cachedProcess
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
