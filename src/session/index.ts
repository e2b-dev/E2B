import {
  CodeSnippetManager,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  codeSnippetMethod,
  CodeSnippetExecState,
  ScanOpenedPortsHandler,
  EnvVars,
} from './codeSnippet'
import { TerminalManager, terminalMethod } from './terminal'
import SessionConnection, {
  SessionConnectionOpts,
} from './sessionConnection'

export interface CodeSnippetOpts {
  onStateChange?: CodeSnippetStateHandler
  onStderr?: CodeSnippetStderrHandler
  onStdout?: CodeSnippetStdoutHandler
  onScanPorts?: ScanOpenedPortsHandler
}

export interface SessionOpts extends SessionConnectionOpts {
  codeSnippet?: CodeSnippetOpts
}

class Session extends SessionConnection {
  private readonly codeSnippetOpts?: CodeSnippetOpts

  codeSnippet?: CodeSnippetManager
  terminal?: TerminalManager

  constructor(opts: SessionOpts) {
    super(opts)
    this.codeSnippetOpts = opts.codeSnippet
  }

  async open() {
    await super.open()

    await Promise.all([
      this.codeSnippetOpts?.onStateChange
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onStateChange, 'state')
        : Promise.resolve(),
      this.codeSnippetOpts?.onStderr
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onStderr, 'stderr')
        : Promise.resolve(),
      this.codeSnippetOpts?.onStdout
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onStdout, 'stdout')
        : Promise.resolve(),
      this.codeSnippetOpts?.onScanPorts
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onScanPorts, 'scanOpenedPorts')
        : Promise.resolve(),
    ])

    // Init CodeSnippet handler
    this.codeSnippet = {
      run: async (code: string, envVars: EnvVars = {}) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        const state = await this.call(`${codeSnippetMethod}_run`, [code, envVars]) as CodeSnippetExecState

        this.codeSnippetOpts?.onStateChange?.(state)

        this.logger.log('Started running code', code)

        return state
      },
      stop: async () => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        const state = await this.call(`${codeSnippetMethod}_stop`) as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)

        this.logger.log('Stopped running code')
        return state
      },
    }

    // Init Terminal handler
    this.terminal = {
      createSession: async (onData, size, activeTerminalID) => {
        try {
          const terminalID = await this.call(`${terminalMethod}_start`, [activeTerminalID ? activeTerminalID : '', size.cols, size.rows])
          if (typeof terminalID !== 'string') {
            throw new Error('Cannot initialize terminal')
          }

          const subscriptionID = await this.subscribe(terminalMethod, onData, 'onData', terminalID)

          return {
            destroy: async () => {
              await this.unsubscribe(subscriptionID)
              await this.call(`${terminalMethod}_destroy`, [terminalID])
            },
            sendData: async (data) => {
              await this.call(`${terminalMethod}_data`, [terminalID, data])

            },
            resize: async ({ cols, rows }) => {
              await this.call(`${terminalMethod}_resize`, [terminalID, cols, rows])
            },
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          this.logger.error(err)
          throw new Error('Error starting terminal session', err)
        }
      }
    }
  }
}

export default Session
