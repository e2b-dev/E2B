import { makeIDGenerator } from '../utils/id'
import { Env } from './constants'
import Runner from './runner'
import EvaluationContext from './evaluationContext'
import { SessionStatus } from './session/sessionManager'

const generateExecutionID = makeIDGenerator(6)

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
}

/**
 * States of a {@link Devbook} connection to a VM.
 */
export enum DevbookStatus {
  /**
   * Devbook is not connected to a VM.
   */
  Disconnected,
  /**
   * Devbook is trying to start or connect to a VM.
   */
  Connecting,
  /**
   * Devbook is connected to a VM and ready to run code or a command.
   */
  Connected,
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

  private _sessionID?: string
  private get sessionID() {
    return this._sessionID
  }
  private set sessionID(value: string | undefined) {
    this._sessionID = value
  }

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

  /**
   * Use this for accessing and manipulating this `Devbook`'s VM's filesystem.
   */
  get fs(): FS {
    return {
      get: this.getFile.bind(this),
      write: this.writeFile.bind(this),
    }
  }

  constructor(private readonly opts: {
    /**
     * Environment that this `Devbook` should use.
     * 
     * This affects which runtime (NodeJS, etc...) will be available and used in the {@link Devbook.runCode} function.
     *
     * `Devbook` instances with different environments are isolated - each has their own filesystem and process namespace.
     */
    env: Env
    /**
     * This function will be called when this `Devbook` receives new stdout after you called {@link Devbook.runCode} or {@link Devbook.runCode}.
     */
    onStdout?: (stdout: string) => void
    /**
     * This function will be called when this `Devbook` receives new stderr after you called {@link Devbook.runCode} or {@link Devbook.runCode}.
     */
    onStderr?: (stderr: string) => void
    /**
     * This function will be called when the {@link Devbook.status} on this `Devbook` changes.
     */
    onStatusChange?: (status: DevbookStatus) => void
    /**
     * This function will be called when the URL for accessing this `Devbook`'s environment changes.
     * 
     * You can assemble URL for any port by using the `getURL` function from the parameter.
     */
    onURLChange?: (getURL: (port: number) => string | undefined) => void
    /**
     * If this value is true then this `Devbook` will print detailed logs.
     */
    debug?: boolean
  }) {
    const getURL = this.getURL.bind(this)
    const getTemplateID = () => this.opts.env
    const getExecutionID = () => this.executionID
    const setIsEnvReady = (value: boolean) => this.isEnvReady = value
    const setSessionStatus = (value: SessionStatus) => this.sessionStatus = value
    const setSessionID = (sessionID?: string) => this.sessionID = sessionID

    this.context = Runner.obj.createContext({
      debug: opts.debug,
      contextID: this.contextID,
      onEnvChange(env) {
        if (env.templateID !== getTemplateID()) return
        setIsEnvReady(env.isReady)

        opts.onURLChange?.(getURL)
      },
      onSessionChange({ status, sessionID }) {
        setSessionID(sessionID)
        setSessionStatus(status)

        opts.onURLChange?.(getURL)
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

    this.context.createRunningEnvironment({
      templateID: opts.env,
    })
  }

  /**
   * Compose the URL that can be used for connecting to a port on the environment defined in this `Devbook`'s constructor.
   * 
   * @param port Number of the port that the URL should be connecting to.
   * @returns URL address that allows you to connect to a specified port on this `Devbook`'s environment 
   * or `undefined` if this `Devbook` is not yet connected to a VM.
   */
  getURL(port: number) {
    if (this.status !== DevbookStatus.Connected) return

    const sessionID = this.sessionID
    if (!this.sessionID) return

    const environment = this.context.getRunningEnvironment({ templateID: this.opts.env })
    if (!environment?.isReady) return

    return `https://${port}-${environment.id}-${sessionID}.o.usedevbook.com`
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
      templateID: this.opts.env,
      executionID: this.executionID,
      command,
    })
  }

  /**
   * Run `code` in the VM using the runtime you passed to this `Devbook`'s constructor as the `env`({@link Env}) parameter.
   * 
   * This {@link Devboook}'s VM shares filesystem and process namespace with other `Devbook`'s with the same `env`({@link Env}) passed to their constructors.
   * 
   * @param code Code to run
   */
  runCode(code: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')

    this.executionID = generateExecutionID()

    this.context.executeCode({
      templateID: this.opts.env,
      executionID: this.executionID,
      code,
    })
  }

  /**
   * Disconnect this `Devbook` from the VM.
   */
  destroy() {
    this.context.destroy()
    this.isDestroyed = true
  }

  private async getFile(path: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')

    return this.context.getFile({
      templateID: this.opts.env,
      path,
    })
  }

  private async writeFile(path: string, content: string) {
    if (this.status !== DevbookStatus.Connected) throw new Error('Not connected to the VM yet.')

    return this.context.updateFile({
      templateID: this.opts.env,
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
