import SessionConnection, {
  SessionConnectionOpts,
} from './sessionConnection'
import {
  CodeSnippetManager,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  codeSnippetMethod,
  CodeSnippetExecState,
  ScanOpenedPortsHandler,
} from './codeSnippet'
import {
  TerminalManager,
  terminalMethod,
} from './terminal'
import {
  FilesystemManager,
  filesystemMethod,
  FileInfo,
} from './filesystem'
import {
  ProcessManager,
  processMethod,
} from './process'

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
  filesystem?: FilesystemManager
  process?: ProcessManager

  constructor(opts: SessionOpts) {
    super(opts)
    this.codeSnippetOpts = opts.codeSnippet
  }

  override readonly open = async () => {
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
      run: async (code, envVars = {}) => {
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

    // Init Filesystem handler
    this.filesystem = {
      listAllFiles: async (path) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }
        const files = await this.call(`${filesystemMethod}_listAllFiles`, [path]) as FileInfo[]
        return files
      },
      removeFile: async (path) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }
        await this.call(`${filesystemMethod}_removeFile`, [path])
      },
      writeFile: async (path, content) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }
        await this.call(`${filesystemMethod}_writeFile`, [path, content])
      },
      readFile: async (path) => {
        if (!this.isOpen || !this.session) {
          throw new Error('Session is not active')
        }
        const content = await this.call(`${filesystemMethod}_readFile`, [path]) as string
        return content
      },
    }

    // Init Terminal handler
    this.terminal = {
      killProcess: async (pid) => {
        await this.call(`${terminalMethod}_killProcess`, [pid])
      },
      createSession: async (onData, onChildProcessesChange, size, activeTerminalID) => {
        try {
          const terminalID = await this.call(`${terminalMethod}_start`, [activeTerminalID ? activeTerminalID : '', size.cols, size.rows])
          if (typeof terminalID !== 'string') {
            throw new Error('Cannot initialize terminal')
          }

          const [onDataSubscriptionID, onChildProcessesChangeSubscriptionID] = await Promise.all([
            this.subscribe(terminalMethod, onData, 'onData', terminalID),
            onChildProcessesChange ? this.subscribe(terminalMethod, onChildProcessesChange, 'onChildProcessesChange', terminalID) : undefined,
          ])

          return {
            terminalID,
            destroy: async () => {
              await this.unsubscribe(onDataSubscriptionID)
              if (onChildProcessesChangeSubscriptionID) await this.unsubscribe(onChildProcessesChangeSubscriptionID)
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

    // Init Process handler
    this.process = {
      start: async (cmd, onStdout, onStderr, envVars = {}, rootdir = '/', activeProcessID) => {
        try {
          const processID = await this.call(`${processMethod}_start`, [activeProcessID ? activeProcessID : '', cmd, envVars, rootdir])
          if (typeof processID !== 'string') {
            throw new Error('Cannot start process')
          }

          const [onStdoutSubscriptionID, onStderrSubscriptionID] = await Promise.all([
            onStdout ? this.subscribe(processMethod, onStdout, 'onStdout', processID) : undefined,
            onStderr ? this.subscribe(processMethod, onStderr, 'onStderr', processID) : undefined,
          ])

          return {
            processID,
            kill: async () => {
              await Promise.all([
                onStdoutSubscriptionID ? this.unsubscribe(onStdoutSubscriptionID) : undefined,
                onStderrSubscriptionID ? this.unsubscribe(onStderrSubscriptionID) : undefined,
                this.call(`${terminalMethod}_kill`, [processID]),
              ])
            },
            sendStdin: async (data) => {
              await this.call(`${processMethod}_stdin`, [processID, data])
            },
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          this.logger.error(err)
          throw new Error('Error starting process', err)
        }
      }
    }
  }
}

export default Session
