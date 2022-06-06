import {
  CodeSnippetManager,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  codeSnippetMethod,
  isCodeSnippetExeecState,
} from './codeSnippet'
import { TerminalManager, terminalMethod } from './terminal'
import SessionConnection, {
  SessionConnectionOpts,
} from './sessionConnection'

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

  codeSnippet?: CodeSnippetManager
  terminal?: TerminalManager

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

        const state = await this.call(`${codeSnippetMethod}_run`, [code])
        if (typeof state !== 'string') {
          throw new Error('Invalid ')
        }

        if (!isCodeSnippetExeecState(state)) {
          throw new Error(`Invalid CS state value "${state}"`)
        }

        this.codeSnippetOpts?.onStateChange?.(state)

        this.logger.log('Started running code', code)

        return state
      },
      stop: async () => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        const state = await this.call(`${codeSnippetMethod}_stop`)
        if (typeof state !== 'string') {
          throw new Error('Invalid ')
        }

        if (!isCodeSnippetExeecState(state)) {
          throw new Error(`Invalid CS state value "${state}"`)
        }

        this.codeSnippetOpts?.onStateChange?.(state)

        this.logger.log('Stopped running code')

        return state
      }
    }

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
    ])

    // Init Terminal handler
    this.terminal = {
      createSession: async (onData, activeTerminalID) => {
        const terminalID = await this.call(`${terminalMethod}_start`, activeTerminalID ? [activeTerminalID] : [])
        if (typeof terminalID !== 'string') {
          throw new Error('Cannot initialize terminal')
        }

        await this.subscribe(terminalMethod, onData, [terminalID])

        return {
          destroy: async () => {
            await this.unsubscribe(terminalMethod, onData)
          },
          sendData: async (data) => {
            await this.call(`${terminalMethod}_data`, [terminalID, data])

          },
          resize: async ({ cols, rows }: { cols: number, rows: number }) => {
            await this.call(`${terminalMethod}_resize`, [terminalID, cols, rows])
          },
        }
      }
    }
  }
}

export default Session
