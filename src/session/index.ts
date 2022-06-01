import {
  CodeSnippet,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  codeSnippetSubscriptionMethod,
} from './codeSnippet'
import { Terminal, terminalSubscriptionMethod } from './terminal'
import SessionConnection, { SessionConnectionOpts } from './sessionConnection'

export interface CodeSnippetOpts {
  onStateChange?: CodeSnippetStateHandler
  onStderr?: CodeSnippetStderrHandler
  onStdout?: CodeSnippetStdoutHandler
}

export interface SessionOpts extends SessionConnectionOpts {
  codeSnippet?: CodeSnippetOpts
}

class Session extends SessionConnection {
  private readonly codeSnippetOpts?: CodeSnippetOpts

  private _codeSnippet?: CodeSnippet
  private set codeSnippet(value: CodeSnippet | undefined) {
    this._codeSnippet = value
  }
  get codeSnippet() {
    return this._codeSnippet
  }

  private _terminal?: Terminal
  private set terminal(value: Terminal | undefined) {
    this._terminal = value
  }
  get terminal() {
    return this._terminal
  }

  constructor(opts: SessionOpts) {
    super(opts)
    this.codeSnippetOpts = opts.codeSnippet
  }

  async open() {
    await super.open()

    // Init CodeSnippet handler
    this.codeSnippet = {
      run: async (code: string) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        await this.call(`${codeSnippetSubscriptionMethod}_run`, [code])
        this.logger.log('Started running code', code)
      },
      stop: async () => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        await this.call(`${codeSnippetSubscriptionMethod}_stop`)
        this.logger.log('Stopped running code')
      }
    }

    await Promise.all([
      this.codeSnippetOpts?.onStateChange
        ? this.subscribe(codeSnippetSubscriptionMethod, this.codeSnippetOpts.onStateChange, 'state')
        : Promise.resolve(),
      this.codeSnippetOpts?.onStderr
        ? this.subscribe(codeSnippetSubscriptionMethod, this.codeSnippetOpts.onStderr, 'stderr')
        : Promise.resolve(),
      this.codeSnippetOpts?.onStdout
        ? this.subscribe(codeSnippetSubscriptionMethod, this.codeSnippetOpts.onStdout, 'stdout')
        : Promise.resolve(),
    ])

    // Init Terminal handler
    this.terminal = {
      createSession: async (onData, activeTerminalID) => {
        const terminalID = await this.call(`${terminalSubscriptionMethod}_start`, activeTerminalID ? [activeTerminalID] : [])
        if (typeof terminalID !== 'string') {
          throw new Error('Cannot initialize terminal')
        }

        await this.subscribe(terminalSubscriptionMethod, onData, [terminalID])

        return {
          destroy: async () => {
            await this.unsubscribe(terminalSubscriptionMethod, onData)
          },
          sendData: async (data) => {
            await this.call(`${terminalSubscriptionMethod}_data`, [terminalID, data])

          },
          resize: async ({ cols, rows }: { cols: number, rows: number }) => {
            await this.call(`${terminalSubscriptionMethod}_resize`, [terminalID, cols, rows])
          },
        }
      }
    }
  }
}

export default Session
