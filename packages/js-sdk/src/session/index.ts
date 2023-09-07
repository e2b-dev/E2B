import normalizePath from 'normalize-path'

import { components } from '../api'
import { id } from '../utils/id'
import { createDeferredPromise, formatSettledErrors, withTimeout } from '../utils/promise'
import {
  ScanOpenedPortsHandler as ScanOpenPortsHandler,
  codeSnippetService,
} from './codeSnippet'
import { FileInfo, FilesystemManager, filesystemService } from './filesystem'
import FilesystemWatcher from './filesystemWatcher'
import {
  Process,
  ProcessManager,
  ProcessMessage,
  ProcessOpts,
  ProcessOutput,
  processService,
} from './process'
import { CallOpts, SessionConnection, SessionConnectionOpts } from './sessionConnection'
import {
  Terminal,
  TerminalManager,
  TerminalOpts,
  TerminalOutput,
  terminalService,
} from './terminal'

export type Environment = components['schemas']['Template']

export interface SessionOpts extends SessionConnectionOpts {
  onScanPorts?: ScanOpenPortsHandler
  timeout?: number
}

export class Session extends SessionConnection {
  readonly terminal: TerminalManager
  readonly filesystem: FilesystemManager
  readonly process: ProcessManager

  private onScanPorts?: ScanOpenPortsHandler

  constructor(opts: SessionOpts) {
    super(opts)
    this.onScanPorts = opts.onScanPorts

    // Init Filesystem handler
    this.filesystem = {
      /**
       * List files in a directory.
       * @param path Path to a directory
       * @param opts Call options
       * @param {timeout} [opts.timeout] Timeout in milliseconds (default is 60 seconds)
       * @returns Array of files in a directory
       */
      list: async (path, opts?: CallOpts) => {
        return (await this.call(filesystemService, 'list', [path], opts)) as FileInfo[]
      },
      /**
       * Reads the whole content of a file.
       * @param path Path to a file
       * @param opts Call options
       * @param {timeout} [opts.timeout] Timeout in milliseconds (default is 60 seconds)
       * @returns Content of a file
       */
      read: async (path, opts?: CallOpts) => {
        return (await this.call(filesystemService, 'read', [path], opts)) as string
      },
      /**
       * Removes a file or a directory.
       * @param path Path to a file or a directory
       * @param opts Call options
       * @param {timeout} [opts.timeout] Timeout in milliseconds (default is 60 seconds)
       */
      remove: async (path, opts?: CallOpts) => {
        await this.call(filesystemService, 'remove', [path], opts)
      },
      /**
       * Writes content to a new file on path.
       * @param path Path to a new file. For example '/dirA/dirB/newFile.txt' when creating 'newFile.txt'
       * @param content Content to write to a new file
       * @param opts Call options
       * @param {timeout} [opts.timeout] Timeout in milliseconds (default is 60 seconds)
       */
      write: async (path, content, opts?: CallOpts) => {
        await this.call(filesystemService, 'write', [path, content], opts)
      },
      // /**
      //  * Write array of bytes to a file.
      //  * This can be used when you cannot represent the data as an UTF-8 string.
      //  *
      //  * @param path path to a file
      //  * @param content byte array representing the content to write
      //  */
      // writeBytes: async (path, content) => {
      //   // We need to convert the byte array to base64 string without using browser or node specific APIs.
      //   // This should be achieved by the node polyfills.
      //   const base64Content = Buffer.from(content).toString('base64')
      //   await this.call(filesystemService, 'writeBase64', [path, base64Content])
      // },
      // /**
      //  * Reads the whole content of a file as an array of bytes.
      //  * @param path path to a file
      //  * @returns byte array representing the content of a file
      //  */
      // readBytes: async path => {
      //   const base64Content = (await this.call(filesystemService, 'readBase64', [
      //     path,
      //   ])) as string
      //   // We need to convert the byte array to base64 string without using browser or node specific APIs.
      //   // This should be achieved by the node polyfills.
      //   return Buffer.from(base64Content, 'base64')
      // },
      /**
       * Creates a new directory and all directories along the way if needed on the specified pth.
       * @param path Path to a new directory. For example '/dirA/dirB' when creating 'dirB'.
       * @param opts Call options
       * @param {timeout} [opts.timeout] Timeout in milliseconds (default is 60 seconds)
       */
      makeDir: async (path, opts?: CallOpts) => {
        await this.call(filesystemService, 'makeDir', [path], opts)
      },
      /**
       * Watches directory for filesystem events.
       * @param path Path to a directory that will be watched
       * @returns New watcher
       */
      watchDir: (path: string) => {
        this.logger.debug?.(`Watching directory "${path}"`)
        const npath = normalizePath(path)
        return new FilesystemWatcher(this, npath)
      },
    }

    // Init Terminal handler
    this.terminal = {
      start: async ({
        onData,
        size,
        onExit,
        envVars,
        cmd,
        rootdir = '',
        terminalID = id(12),
        timeout = undefined,
      }: TerminalOpts) => {
        const start = async ({
          onData,
          size,
          onExit,
          envVars,
          cmd,
          rootdir = '',
          terminalID = id(12),
        }: Omit<TerminalOpts, 'timeout'>) => {
          this.logger.debug?.(`Starting terminal "${terminalID}"`)
          const { promise: terminalExited, resolve: triggerExit } =
            createDeferredPromise()

          const output = new TerminalOutput()

          function handleData(data: string) {
            output.addData(data)
            onData?.(data)
          }

          const [onDataSubID, onExitSubID] = await this.handleSubscriptions(
            this.subscribe(terminalService, handleData, 'onData', terminalID),
            this.subscribe(terminalService, triggerExit, 'onExit', terminalID),
          )

          const { promise: unsubscribing, resolve: handleFinishUnsubscribing } =
            createDeferredPromise<TerminalOutput>()

          terminalExited.then(async () => {
            const results = await Promise.allSettled([
              this.unsubscribe(onExitSubID),
              this.unsubscribe(onDataSubID),
            ])
            this.logger.debug?.(`Terminal "${terminalID}" exited`)

            const errMsg = formatSettledErrors(results)
            if (errMsg) {
              this.logger.error?.(errMsg)
            }

            onExit?.()
            handleFinishUnsubscribing(output)
          })

          try {
            await this.call(terminalService, 'start', [
              terminalID,
              size.cols,
              size.rows,
              // Handle optional args for old devbookd compatibility
              ...(cmd !== undefined ? [envVars, cmd, rootdir] : []),
            ])
          } catch (err) {
            triggerExit()
            await unsubscribing
            throw err
          }

          return new Terminal(terminalID, this, triggerExit, unsubscribing, output)
        }
        return await withTimeout(
          start,
          timeout,
        )({
          onData,
          size,
          onExit,
          envVars,
          cmd,
          rootdir,
          terminalID,
        })
      },
    }

    // Init Process handler
    this.process = {
      start: async (opts: ProcessOpts) => {
        const start = async ({
          cmd,
          onStdout,
          onStderr,
          onExit,
          envVars = {},
          rootdir = '',
          processID = id(12),
        }: Omit<ProcessOpts, 'timeout'>) => {
          if (!cmd) {
            throw new Error('cmd is required')
          }
          this.logger.debug?.(`Starting process "${processID}"`)

          const { promise: processExited, resolve: triggerExit } = createDeferredPromise()

          const output = new ProcessOutput()

          function handleStdout(data: { line: string; timestamp: number }) {
            const message = new ProcessMessage(data.line, data.timestamp, false)
            output.addStdout(message)
            onStdout?.(message)
          }

          function handleStderr(data: { line: string; timestamp: number }) {
            const message = new ProcessMessage(data.line, data.timestamp, true)
            output.addStderr(message)
            onStderr?.(message)
          }

          const [onExitSubID, onStdoutSubID, onStderrSubID] =
            await this.handleSubscriptions(
              this.subscribe(processService, triggerExit, 'onExit', processID),
              this.subscribe(processService, handleStdout, 'onStdout', processID),
              this.subscribe(processService, handleStderr, 'onStderr', processID),
            )

          const { promise: unsubscribing, resolve: handleFinishUnsubscribing } =
            createDeferredPromise<ProcessOutput>()

          processExited.then(async () => {
            const results = await Promise.allSettled([
              this.unsubscribe(onExitSubID),
              onStdoutSubID ? this.unsubscribe(onStdoutSubID) : undefined,
              onStderrSubID ? this.unsubscribe(onStderrSubID) : undefined,
            ])
            this.logger.debug?.(`Process "${processID}" exited`)

            const errMsg = formatSettledErrors(results)
            if (errMsg) {
              this.logger.error?.(errMsg)
            }

            onExit?.()
            handleFinishUnsubscribing(output)
          })

          try {
            await this.call(processService, 'start', [processID, cmd, envVars, rootdir])
          } catch (err) {
            triggerExit()
            await unsubscribing
            throw err
          }

          return new Process(processID, this, triggerExit, unsubscribing, output)
        }
        const timeout = opts.timeout
        return await withTimeout(start, timeout)(opts)
      },
    }
  }

  static async create(opts: SessionOpts) {
    return new Session(opts).open({ timeout: opts?.timeout })
  }

  override async open(opts: CallOpts) {
    await super.open(opts)

    const portsHandler = this.onScanPorts
      ? (ports: { State: string; Ip: string; Port: number }[]) =>
          this.onScanPorts?.(ports.map(p => ({ ip: p.Ip, port: p.Port, state: p.State })))
      : undefined

    await this.handleSubscriptions(
      portsHandler
        ? this.subscribe(codeSnippetService, portsHandler, 'scanOpenedPorts')
        : undefined,
    )

    return this
  }
}
