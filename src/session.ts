import WebSocket from 'rpc-websockets'

import api, { components, getSessionURL } from './api'
import wait from './utils/wait'
import {
  SESSION_REFRESH_PERIOD,
  WS_PORT,
} from './constants'

const getSession = api.path('/sessions').method('post').create()
const refreshSession = api.path('/sessions/{sessionID}/refresh').method('put').create()

class Session {
  private session?: components['schemas']['Session']
  private ws?: WebSocket.Client
  private isRunning = false

  constructor(
    private readonly codeSnippetID: string,
    private readonly onDisconnect?: () => void,
  ) { }

  disconnect() {
    if (this.isRunning) {
      this.isRunning = false
      this.ws?.close()
      this.onDisconnect?.()
    }
  }

  async connect() {
    if (this.isRunning || !!this.session) {
      return
    } else {
      this.isRunning = true
    }

    const res = await getSession({ codeSnippetID: this.codeSnippetID })

    this.session = res.data
    this.refresh(this.session.sessionID)

    const sessionURL = `wss://${getSessionURL(this.session, WS_PORT)}`
    this.ws = new WebSocket.Client(sessionURL)

    let resolveWaitForOpen: undefined | (() => void)
    let rejectWaitForOpen: undefined | ((reason: string) => void)
    const waitForOpen = new Promise<void>((resolve, reject) => {
      resolveWaitForOpen = resolve
      rejectWaitForOpen = reject
    })

    // eslint-disable-next-line prefer-const
    let unsubscribe: undefined | (() => void)

    const handleClose = () => {
      unsubscribe?.()
      this.disconnect()
    }
    const handleError = () => {
      unsubscribe?.()
      rejectWaitForOpen?.('WS connection to session failed')
    }
    const handleOpen = () => {
      unsubscribe?.()
      resolveWaitForOpen?.()
    }

    unsubscribe = () => {
      this.ws?.off('close', handleClose)
      this.ws?.off('error', handleError)
      this.ws?.off('open', handleOpen)
    }

    this.ws.once('close', handleClose)
    this.ws.once('error', handleError)
    this.ws.once('open', handleOpen)

    return waitForOpen
  }

  private async refresh(sessionID: string) {
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (!this.isRunning) {
          throw new Error('Cannot refresh session - it was closed')
        }

        await refreshSession({ sessionID })
        await wait(SESSION_REFRESH_PERIOD)
      }
    } finally {
      this.disconnect()
    }
  }
}

export default Session
