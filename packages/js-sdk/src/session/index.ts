import normalizePath from 'normalize-path'

import { components } from '../api'
import { id } from '../utils/id'
import { createDeferredPromise, formatSettledErrors } from '../utils/promise'
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
  ProcessOutput,
  processService,
} from './process'
import { SessionConnection, SessionConnectionOpts } from './sessionConnection'
import { Terminal, TerminalManager, TerminalOutput, terminalService } from './terminal'

export type Environment = components['schemas']['Template']

export interface SessionOpts extends SessionConnectionOpts {
  onScanPorts?: ScanOpenPortsHandler
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
       * @param path path to a directory
       * @returns Array of files in a directory
       */
      list: async path => {
        return (await this.call(filesystemService, 'list', [path])) as FileInfo[]
      },
      /**
       * Reads the whole content of a file.
       * @param path path to a file
       * @returns Content of a file
       */
      read: async path => {
        return (await this.call(filesystemService, 'read', [path])) as string
      },
      /**
       * Removes a file or a directory.
       * @param path path to a file or a directory
       */
      remove: async path => {
        await this.call(filesystemService, 'remove', [path])
      },
      /**
       * Writes content to a new file on path.
       * @param path path to a new file. For example '/dirA/dirB/newFile.txt' when creating 'newFile.txt'
       * @param content content to write to a new file
       */
      write: async (path, content) => {
        await this.call(filesystemService, 'write', [path, content])
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
       * @param path path to a new directory. For example '/dirA/dirB' when creating 'dirB'.
       */
      makeDir: async path => {
        await this.call(filesystemService, 'makeDir', [path])
      },
      /**
       * Watches directory for filesystem events.
       * @param path path to a directory that will be watched
       * @returns new watcher
       */
      watchDir: (path: string) => {
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
      }) => {
        const { promise: terminalExited, resolve: triggerExit } = createDeferredPromise()

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

          const errMsg = formatSettledErrors(results)
          if (errMsg) {
            this.logger.error(errMsg)
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
        rootdir = '',
        processID = id(12),
      }) => {
        if (!cmd) {
          throw new Error('cmd is required')
        }

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

          const errMsg = formatSettledErrors(results)
          if (errMsg) {
            this.logger.error(errMsg)
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
      },
    }
  }

  static async create(opts: SessionOpts) {
    return await new Session(opts).open()
  }

  override async open() {
    await super.open()

    const portsHander = this.onScanPorts
      ? (ports: { State: string; Ip: string; Port: number }[]) =>
          this.onScanPorts?.(ports.map(p => ({ ip: p.Ip, port: p.Port, state: p.State })))
      : undefined

    await this.handleSubscriptions(
      portsHander
        ? this.subscribe(codeSnippetService, portsHander, 'scanOpenedPorts')
        : undefined,
    )

    return this
  }
}
