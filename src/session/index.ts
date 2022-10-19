import normalizePath from 'normalize-path'

import { id } from '../utils/id'
import { createDeferredPromise, formatSettledErrors } from '../utils/promise'
import {
  CodeSnippetExecState,
  CodeSnippetManager,
  CodeSnippetStateHandler,
  CodeSnippetStderrHandler,
  CodeSnippetStdoutHandler,
  ScanOpenedPortsHandler,
  codeSnippetService,
} from './codeSnippet'
import { FileInfo, FilesystemManager, filesystemService } from './filesystem'
import FilesystemWatcher from './filesystemWatcher'
import { ProcessManager, processService } from './process'
import SessionConnection, { SessionConnectionOpts } from './sessionConnection'
import { TerminalManager, terminalService } from './terminal'

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
  codeSnippet?: CodeSnippetManager
  terminal?: TerminalManager
  filesystem?: FilesystemManager
  process?: ProcessManager

  private readonly codeSnippetOpts?: CodeSnippetOpts

  constructor(opts: SessionOpts) {
    super(opts)
    this.codeSnippetOpts = opts.codeSnippet
  }

  async open() {
    await super.open()

    await this.handleSubscriptions(
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
        ? this.subscribe(
            codeSnippetService,
            this.codeSnippetOpts.onScanPorts,
            'scanOpenedPorts',
          )
        : undefined,
    )

    // Init CodeSnippet handler
    this.codeSnippet = {
      run: async (code, envVars = {}) => {
        const state = (await this.call(codeSnippetService, 'run', [
          code,
          envVars,
        ])) as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)
        return state
      },
      stop: async () => {
        const state = (await this.call(
          codeSnippetService,
          'stop',
        )) as CodeSnippetExecState
        this.codeSnippetOpts?.onStateChange?.(state)
        return state
      },
    }

    // Init Filesystem handler
    this.filesystem = {
      listAllFiles: async path => {
        return (await this.call(filesystemService, 'listAllFiles', [path])) as FileInfo[]
      },
      readFile: async path => {
        return (await this.call(filesystemService, 'readFile', [path])) as string
      },
      removeFile: async path => {
        await this.call(filesystemService, 'removeFile', [path])
      },
      writeFile: async (path, content) => {
        await this.call(filesystemService, 'writeFile', [path, content])
      },
      watch: (path: string) => {
        const npath = normalizePath(path)
        return new FilesystemWatcher(this, npath)
      },
    }

    // Init Terminal handler
    this.terminal = {
      createSession: async ({
        onData,
        onChildProcessesChange,
        size,
        onExit,
        terminalID = id(12),
      }) => {
        const { promise: terminalExited, resolve: triggerExit } = createDeferredPromise()

        const [onDataSubID, onExitSubID, onChildProcessesChangeSubID] =
          await this.handleSubscriptions(
            this.subscribe(terminalService, onData, 'onData', terminalID),
            this.subscribe(terminalService, triggerExit, 'onExit', terminalID),
            onChildProcessesChange
              ? this.subscribe(
                  terminalService,
                  onChildProcessesChange,
                  'onChildProcessesChange',
                  terminalID,
                )
              : undefined,
          )

        const { promise: unsubscribing, resolve: handleFinishUnsubscribing } =
          createDeferredPromise()

        terminalExited.then(async () => {
          const results = await Promise.allSettled([
            this.unsubscribe(onExitSubID),
            this.unsubscribe(onDataSubID),
            onChildProcessesChangeSubID
              ? this.unsubscribe(onChildProcessesChangeSubID)
              : undefined,
          ])

          const errMsg = formatSettledErrors(results)
          if (errMsg) {
            this.logger.error(errMsg)
          }

          onExit?.()
          handleFinishUnsubscribing()
        })

        try {
          await this.call(terminalService, 'start', [terminalID, size.cols, size.rows])
        } catch (err) {
          triggerExit()
          await unsubscribing
          throw err
        }

        return {
          destroy: async () => {
            try {
              await this.call(terminalService, 'destroy', [terminalID])
            } finally {
              triggerExit()
              await unsubscribing
            }
          },
          resize: async ({ cols, rows }) => {
            await this.call(terminalService, 'resize', [terminalID, cols, rows])
          },
          sendData: async data => {
            await this.call(terminalService, 'data', [terminalID, data])
          },
          terminalID,
        }
      },
      killProcess: async pid => {
        await this.call(terminalService, 'killProcess', [pid])
      },
    }

    // Init Process handler
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
        const { promise: processExited, resolve: triggerExit } = createDeferredPromise()

        const [onExitSubID, onStdoutSubID, onStderrSubID] =
          await this.handleSubscriptions(
            this.subscribe(processService, triggerExit, 'onExit', processID),
            onStdout
              ? this.subscribe(processService, onStdout, 'onStdout', processID)
              : undefined,
            onStderr
              ? this.subscribe(processService, onStderr, 'onStderr', processID)
              : undefined,
          )

        const { promise: unsubscribing, resolve: handleFinishUnsubscribing } =
          createDeferredPromise()

        processExited.then(async () => {
          const results = await Promise.allSettled([
            this.unsubscribe(onExitSubID),
            onStdoutSubID ? this.unsubscribe(onStdoutSubID) : undefined,
            onStderrSubID ? this.unsubscribe(onStderrSubID) : undefined,
          ])

          const errMsg = formatSettledErrors(results)
          if (errMsg) {
            this.logger.error(errMsg)
          }

          onExit?.()
          handleFinishUnsubscribing()
        })

        try {
          await this.call(processService, 'start', [processID, cmd, envVars, rootdir])
        } catch (err) {
          triggerExit()
          await unsubscribing
          throw err
        }

        return {
          kill: async () => {
            try {
              await this.call(processService, 'kill', [processID])
            } finally {
              triggerExit()
              await unsubscribing
            }
          },
          processID,
          sendStdin: async data => {
            await this.call(processService, 'stdin', [processID, data])
          },
        }
      },
    }
  }
}

export default Session
