import SessionConnection, {
  SessionConnectionOpts,
} from './sessionConnection'
import {
  CodeSnippetManager,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  codeSnippetService,
  CodeSnippetExecState,
  ScanOpenedPortsHandler,
} from './codeSnippet'
import {
  TerminalManager,
  terminalService,
} from './terminal'
import {
  FilesystemManager,
  FileInfo,
  filesystemService,
} from './filesystem'
import {
  ProcessManager,
  processService,
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

  codeSnippet?: CodeSnippetManager
  terminal?: TerminalManager
  filesystem?: FilesystemManager
  process?: ProcessManager

  constructor(opts: SessionOpts) {
    super(opts)
    this.codeSnippetOpts = opts.codeSnippet
  }

  async open() {
    await super.open()

    await Promise.all([
      this.codeSnippetOpts?.onStateChange
        ? this.subscribe(codeSnippetService, this.codeSnippetOpts.onStateChange, 'state')
        : undefined,
      this.codeSnippetOpts?.onStderr
        ? this.subscribe(codeSnippetService, this.codeSnippetOpts.onStderr, 'stderr')
        : undefined,
      this.codeSnippetOpts?.onStdout
        ? this.subscribe(codeSnippetService, this.codeSnippetOpts.onStdout, 'stdout')
        : undefined,
      this.codeSnippetOpts?.onScanPorts
        ? this.subscribe(codeSnippetService, this.codeSnippetOpts.onScanPorts, 'scanOpenedPorts')
        : undefined,
    ])

    // Init CodeSnippet handler
    this.codeSnippet = {
      run: async (code, envVars = {}) => {
        const state = await this.call(codeSnippetService, 'run', [code, envVars]) as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)
        return state
      },
      stop: async () => {
        const state = await this.call(codeSnippetService, 'stop') as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)
        return state
      },
    }

    // Init Filesystem handler
    this.filesystem = {
      listAllFiles: async (path) => {
        return await this.call(filesystemService, 'listAllFiles', [path]) as FileInfo[]
      },
      removeFile: async (path) => {
        await this.call(filesystemService, 'removeFile', [path])
      },
      writeFile: async (path, content) => {
        await this.call(filesystemService, 'writeFile', [path, content])
      },
      readFile: async (path) => {
        return await this.call(filesystemService, 'readFile', [path]) as string
      },
    }

    // Init Terminal handler
    // TODO: If the process or one of the subscriptions fails to register we are currently not unsubscribing from the others
    // We are generating process ID in the SDK because we need to subscribe to the process stdout/stderr before starting it.
    this.terminal = {
      killProcess: async (pid) => {
        await this.call(terminalService, 'killProcess', [pid])
      },
      createSession: async ({
        onData,
        onChildProcessesChange,
        size,
        terminalID = id(12),
      }) => {
        const [
          onDataSubscriptionID,
          onChildProcessesChangeSubscriptionID,
        ] = await Promise.all([
          this.subscribe(terminalService, onData, 'onData', terminalID),
          onChildProcessesChange ? this.subscribe(terminalService, onChildProcessesChange, 'onChildProcessesChange', terminalID) : undefined,
        ])

        await this.call(terminalService, 'start', [terminalID, size.cols, size.rows])

        return {
          terminalID,
          destroy: async () => {
            await Promise.all([
              this.unsubscribe(onDataSubscriptionID),
              onChildProcessesChangeSubscriptionID ? this.unsubscribe(onChildProcessesChangeSubscriptionID) : undefined,
              await this.call(terminalService, 'destroy', [terminalID])
            ])
          },
          sendData: async (data) => {
            await this.call(terminalService, 'data', [terminalID, data])
          },
          resize: async ({ cols, rows }) => {
            await this.call(terminalService, 'resize', [terminalID, cols, rows])
          },
        }
      }
    }

    // Init Process handler
    // TODO: If the process or one of the subscriptions fails to register we are currently not unsubscribing from the others
    // We are generating process ID in the SDK because we need to subscribe to the process stdout/stderr before starting it.
    this.process = {
      start: async ({
        cmd,
        onStdout,
        onStderr,
        onExit,
        envVars = {},
        rootdir = '/',
        processID = id(12),
      }) => {
        const [
          onExitSubscriptionID,
          onStdoutSubscriptionID,
          onStderrSubscriptionID,
        ] = await Promise.all([
          onExit ? this.subscribe(processService, onExit, 'onExit', processID) : undefined,
          onStdout ? this.subscribe(processService, onStdout, 'onStdout', processID) : undefined,
          onStderr ? this.subscribe(processService, onStderr, 'onStderr', processID) : undefined,
        ])

        await this.call(processService, 'start', [processID, cmd, envVars, rootdir])

        return {
          processID,
          kill: async () => {
            if (onExitSubscriptionID) await this.unsubscribe(onExitSubscriptionID)

            await Promise.all([
              onStdoutSubscriptionID ? this.unsubscribe(onStdoutSubscriptionID) : undefined,
              onStderrSubscriptionID ? this.unsubscribe(onStderrSubscriptionID) : undefined,
              this.call(processService, 'kill', [processID]),
            ])

            onExit?.()
          },
          sendStdin: async (data) => {
            await this.call(processService, 'stdin', [processID, data])
          },
        }
      }
    }
  }
}

export default Session
