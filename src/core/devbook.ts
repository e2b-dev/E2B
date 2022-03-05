import { makeIDGenerator } from '../utils/id'
import Runner from './runner'
import EvaluationContext from './evaluationContext'
import { SessionStatus } from './session/sessionManager'
import { Filesystem } from './runningEnvironment/filesystem'

const generateExecutionID = makeIDGenerator(6)

// Normally, we would name this enum `TemplateID` but since this enum is exposed to users
// it makes more sense to name it `Env` because it's less confusing for users.
/**
 * Runtime environment to use with the Devbooks' VMs.
 */
export type Env = string

/**
 * Devbook config required to correctly start your Devbook VMs.
 */
export interface Config {
  /**
   * E.g.: acme.usedevbook.com
   * Note: Don't include protocol!
   */
  domain: string,
}

/**
 * Methods for accessing and manipulating this `Devbook`'s VM's filesystem.
 */
export interface FS {
  /**
   * Retrieve content from a file on a specified `path`.
   *
   * This {@link Devboook}'s VM shares filesystem and process namespace with other `Devbook`'s with the same `env`({@link Env}) passed to their constructors.
   *
   * @param path Path to the file
   * @return `string` if the file exists or `undefined` if it doesn't.
   */
  get: (path: string) => Promise<string | undefined>
  /**
   * Write `content` to the file on the specified `path`.
   * This method will create the file and necessary folders is they don't exist.
   *
   * This {@link Devboook}'s VM shares filesystem and process namespace with other `Devbook`'s with the same `env`({@link Env}) passed to their constructors.
   *
   * @param path Path to the file
   * @param content Content to write into file
   */
  write: (path: string, content: string) => Promise<void>
  delete: (path: string) => void
  listDir: (path: string) => void
  createDir: (path: string) => void
  serialize: Filesystem['serialize']
  addListener: Filesystem['addListener']
  removeListener: Filesystem['removeListener']
}

export interface Terminal {
  createSession: (onData: (data: string) => void, activeTerminalID?: string) => Promise<{
    sendData: (data: string) => void
    resize: ({ cols, rows }: { cols: number, rows: number }) => void
    destroy: () => void
  }>
}

/**
 * States of a {@link Devbook} connection to a VM.
 */
export enum DevbookStatus {
  /**
   * Devbook is not connected to a VM.
   */
  Disconnected = 'Disconnected',
  /**
   * Devbook is trying to start or connect to a VM.
   */
  Connecting = 'Connecting',
  /**
   * Devbook is connected to a VM and ready to run code or a command.
   */
  Connected = 'Connected',
}

/**
 * Representation of a connection to a VM that is used for running code and commands.
 *
 * You can have multiple `Devbook` class instances connected to the same VM -
 * instances with the same `env`({@link Env}) parameter passed to the constructor will share filesystem and process namespace.
 */
class Devbook {
  private readonly context: EvaluationContext
  private readonly contextID = 'default'
  private executionID = generateExecutionID()

  private _isDestroyed = false
  private get isDestroyed() {
    return this._isDestroyed
  }
  private set isDestroyed(value: boolean) {
    this._isDestroyed = value
    this.updateStatus()
  }

  private _isEnvReady = false
  private get isEnvReady() {
    return this._isEnvReady
  }
  private set isEnvReady(value: boolean) {
    this._isEnvReady = value
    this.updateStatus()
  }

  private _sessionStatus = SessionStatus.Disconnected
  private get sessionStatus() {
    return this._sessionStatus
  }
  private set sessionStatus(value: SessionStatus) {
    this._sessionStatus = value
    this.updateStatus()
  }

  private _status = DevbookStatus.Disconnected
  /**
   * Current status of this `Devbook`'s connection.
   */
  get status() {
    return this._status
  }
  private set status(value: DevbookStatus) {
    this._status = value
    this.opts.onStatusChange?.(value)
  }

  private get env() {
    return this.context.env
  }

  readonly terminal: Terminal

  /**
   * Use this for accessing and manipulating this `Devbook`'s VM's filesystem.
   */
  readonly fs: FS

  constructor(private readonly opts: {
    /**
     * Environment that this `Devbook` should use.
     *
     * This affects which runtime (NodeJS, etc...) will be available and used in the {@link Devbook.runCmd} function.
     *
     * `Devbook` instances with different environments are isolated - each has their own filesystem and process namespace.
     */
    env: Env
    /**
     * This function will be called when this `Devbook` receives new stdout after you called {@link Devbook.runCmd}.
     */
    onStdout?: (stdout: string) => void
    /**
     * This function will be called when this `Devbook` receives new stderr after you called {@link Devbook.runCmd}.
     */
    onStderr?: (stderr: string) => void
    /**
     * This function will be called when the {@link Devbook.status} on this `Devbook` changes.
     */
    onStatusChange?: (status: DevbookStatus) => void
    /**
     * If this value is true then this `Devbook` will print detailed logs.
     */
    debug?: boolean
    /**
     * Devbook config required to correctly start your Devbook VMs.
     */
    config: Config,
  }) {
    // Explicitely check for config to be defined so we can notify the developer with an error.
    if (!opts.config) throw new Error('Missing Devbook config')

    const getTemplateID = () => this.opts.env
    const getExecutionID = () => this.executionID
    const setIsEnvReady = (value: boolean) => this.isEnvReady = value
    const setSessionStatus = (value: SessionStatus) => this.sessionStatus = value

    Runner.config = this.opts.config

    this.context = Runner.obj.createContext({
      debug: opts.debug,
      templateID: opts.env,
      contextID: this.contextID,
      onEnvChange(env) {
        if (env.templateID !== getTemplateID()) return
        setIsEnvReady(env.isReady)
      },
      onSessionChange({ status }) {
        setSessionStatus(status)
      },
      onCmdOut(payload) {
        if (payload.executionID !== getExecutionID()) return
        if (payload.stdout !== undefined) {
          opts.onStdout?.(payload.stdout)
        }
        if (payload.stderr !== undefined) {
          opts.onStderr?.(payload.stderr)
        }
      },
    })

    this.fs = {
      delete: this.deleteFile.bind(this),
      listDir: this.listDir.bind(this),
      createDir: this.createDir.bind(this),
      get: this.getFile.bind(this),
      write: this.writeFile.bind(this),
      addListener: this.env.filesystem.addListener.bind(this.env.filesystem),
      removeListener: this.env.filesystem.removeListener.bind(this.env.filesystem),
      serialize: this.env.filesystem.serialize.bind(this.env.filesystem),
    }

    this.terminal = {
      createSession: async (onData, activeTerminalID) => {
        const terminalID = await this.context.startTerminal({ terminalID: activeTerminalID })
        const unsubscribe = this.context.onTerminalData({ onData, terminalID })

        return {
          destroy: () => {
            unsubscribe()
          },
          sendData: (data) => {
            this.context.sendTerminalData({ terminalID, data })
          },
          resize: ({ cols, rows }: { cols: number, rows: number }) => {
            this.context.resizeTerminal({ terminalID, cols, rows })
          },
        }
      }
    }
  }

  /**
   * Run `command` in the VM.
   *
   * This {@link Devboook}'s VM shares filesystem and process namespace with other `Devbook`'s with the same `env`({@link Env}) passed to their constructors.
   *
   * @param command Command to run
   */
  runCmd(command: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')

    this.executionID = generateExecutionID()

    this.context.executeCommand({
      executionID: this.executionID,
      command,
    })
  }

  /**
   * Disconnect this `Devbook` from the VM.
   */
  destroy() {
    this.context.destroy()
    this.isDestroyed = true
  }

  /** @internal */
  __internal__start() {
    Runner.obj.__internal__start()
  }

  /** @internal */
  __internal__stop() {
    Runner.obj.__internal__stop()
  }

  private listDir(path: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')
    return this.context.listDir({ path })
  }

  private createDir(path: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')
    return this.context.createDir({ path })
  }

  private deleteFile(path: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')
    return this.context.deleteFile({ path })
  }

  private getFile(path: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')
    return this.context.getFile({ path })
  }

  private writeFile(path: string, content: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')
    return this.context.updateFile({
      path,
      content,
    })
  }

  private updateStatus() {
    if (this.isDestroyed) {
      if (this.status !== DevbookStatus.Disconnected) {
        this.status = DevbookStatus.Disconnected
      }
      return
    }

    let status: DevbookStatus
    switch (this.sessionStatus) {
      case SessionStatus.Disconnected:
        status = DevbookStatus.Disconnected
        break
      case SessionStatus.Connecting:
        status = DevbookStatus.Connecting
        break
      case SessionStatus.Connected:
        if (!this.isEnvReady) {
          status = DevbookStatus.Connecting
          break
        }
        status = DevbookStatus.Connected
        break
    }
    this.status = status
  }
}

export default Devbook
