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
import { id } from '../utils/id'

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

  private _codeSnippet?: CodeSnippetManager
  private _terminal?: TerminalManager
  private _filesystem?: FilesystemManager
  private _process?: ProcessManager

  get codeSnippet() {
    return (this.isOpen && this.session) ? this._codeSnippet : undefined
  }

  get terminal() {
    return (this.isOpen && this.session) ? this._terminal : undefined
  }

  get filesystem() {
    return (this.isOpen && this.session) ? this._filesystem : undefined
  }

  get process() {
    return (this.isOpen && this.session) ? this._process : undefined
  }

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
    this._codeSnippet = {
      run: async (code, envVars = {}) => {
        const state = await this.call(`${codeSnippetMethod}_run`, [code, envVars]) as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)
        return state
      },
      stop: async () => {
        const state = await this.call(`${codeSnippetMethod}_stop`) as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)
        return state
      },
    }

    // Init Filesystem handler
    this._filesystem = {
      listAllFiles: async (path) => {
        const files = await this.call(`${filesystemMethod}_listAllFiles`, [path]) as FileInfo[]
        return files
      },
      removeFile: async (path) => {
        await this.call(`${filesystemMethod}_removeFile`, [path])
      },
      writeFile: async (path, content) => {
        await this.call(`${filesystemMethod}_writeFile`, [path, content])
      },
      readFile: async (path) => {
        const content = await this.call(`${filesystemMethod}_readFile`, [path]) as string
        return content
      },
    }

    // Init Terminal handler
    this._terminal = {
      killProcess: async (pid) => {
        await this.call(`${terminalMethod}_killProcess`, [pid])
      },
      createSession: async ({ onData, onChildProcessesChange, size, activeTerminalID }) => {
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
              await Promise.all([
                this.unsubscribe(onDataSubscriptionID),
                onChildProcessesChangeSubscriptionID ? this.unsubscribe(onChildProcessesChangeSubscriptionID) : undefined,
                await this.call(`${terminalMethod}_destroy`, [terminalID])
              ])
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
    this._process = {
      start: async ({ cmd, onStdout, onStderr, onExit, envVars = {}, rootdir = '/' }) => {
        // We are generating process ID in the SDK because we need to subscribe to the process stdout/stderr before starting it.
        const processID = id(12)
        try {
          const [onExitSubscriptionID, onStdoutSubscriptionID, onStderrSubscriptionID] = await Promise.all([
            onExit ? this.subscribe(processMethod, onExit, 'onExit', processID) : undefined,
            onStdout ? this.subscribe(processMethod, onStdout, 'onStdout', processID) : undefined,
            onStderr ? this.subscribe(processMethod, onStderr, 'onStderr', processID) : undefined,
          ])

          await this.call(`${processMethod}_start`, [processID, cmd, envVars, rootdir])

          return {
            processID,
            kill: async () => {
              if (onExitSubscriptionID) await this.unsubscribe(onExitSubscriptionID)

              await Promise.all([
                onStdoutSubscriptionID ? this.unsubscribe(onStdoutSubscriptionID) : undefined,
                onStderrSubscriptionID ? this.unsubscribe(onStderrSubscriptionID) : undefined,
                this.call(`${terminalMethod}_kill`, [processID]),
              ])

              onExit?.()
            },
            sendStdin: async (data) => {
              await this.call(`${processMethod}_stdin`, [processID, data])
            },
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // TODO: If the process or one of the subscriptions fails to register we are currently not unsubscribing from the others
          this.logger.error(err)
          throw new Error('Error starting process', err)
        }
      }
    }
  }
}

export default Session
