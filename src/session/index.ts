import {
  CodeSnippetManager,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  codeSnippetMethod,
  CodeSnippetExecState,
  DepsErrorResponse,
  DepsStdoutHandler,
  DepsStderrHandler,
  DepsChangeHandler,
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
  onDepsStdout?: DepsStdoutHandler
  onDepsStderr?: DepsStderrHandler
  onDepsChange?: DepsChangeHandler
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
      this.codeSnippetOpts?.onDepsStdout
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onDepsStdout, 'depsStdout')
        : Promise.resolve(),
      this.codeSnippetOpts?.onDepsStderr
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onDepsStderr, 'depsStderr')
        : Promise.resolve(),
      this.codeSnippetOpts?.onDepsChange
        ? this.subscribe(codeSnippetMethod, this.codeSnippetOpts.onDepsChange, 'depsChange')
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
      listDeps: async () => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        this.logger.log('Started listing deps')
        const deps = await this.call(`${codeSnippetMethod}_deps`) as string[]
        this.logger.log('Stopped listing deps', deps)
        return deps
      },
      installDep: async (dep: string) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        this.logger.log('Started installing dependency', dep)
        const response = await this.call(`${codeSnippetMethod}_installDep`, [dep]) as DepsErrorResponse
        this.logger.log('Stopped installing dependency', response)
        return response
      },
      uninstallDep: async (dep: string) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }

        this.logger.log('Started uninstalling dependency', dep)
        const response = await this.call(`${codeSnippetMethod}_uninstallDep`, [dep]) as DepsErrorResponse
        this.logger.log('Stopped uninstalling dependency', response)
        return response
      },
    }

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
