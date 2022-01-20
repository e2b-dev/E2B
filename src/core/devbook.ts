import { makeIDGenerator } from 'src/utils/id'
import {
  Env,
  templates,
} from './constants'
import Runner from './runner'
import EvaluationContext from './evaluationContext'
import { SessionStatus } from './session/sessionManager'

const generateExecutionID = makeIDGenerator(6)

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
  private readonly executionID: string
  private readonly contextID: string

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

  constructor(private readonly opts: {
    /**
     * Environment that this Devbook should use.
     * 
     * This affects which runtime (NodeJS, etc...) will be available and used in the {@link Devbook.runCode} function.
     *
     * {@link Devbook} classes with different environments are isolated - each has their own filesystem and process namespace.
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
     * If this value is true then this Devbook will print detailed logs.
     */
    debug?: boolean
  }) {
    const contextID = 'default'
    this.contextID = contextID

    const executionID = generateExecutionID()
    this.executionID = executionID

    const setIsEnvReady = (value: boolean) => this.isEnvReady = value
    const setSessionStatus = (value: SessionStatus) => this.sessionStatus = value

    this.context = Runner.obj.createContext({
      debug: opts.debug,
      contextID,
      onEnvChange(env) {
        setIsEnvReady(env.isReady)
      },
      onSessionChange({ status }) {
        setSessionStatus(status)
      },
      onCmdOut(payload) {
        if (payload.executionID !== executionID) return
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
   * Run `command` in the VM.
   * 
   * This {@link Devboook}'s VM shares filesystem and process namespace with other Devbook`s with the same `env`({@link Env}) passed to their constructors.
   * 
   * @param command Command to run
   */
  runCmd(command: string) {
    if (this.status === DevbookStatus.Disconnected) return

    this.context.executeCommand({
      templateID: this.opts.env,
      executionID: this.executionID,
      command,
    })
  }

  /**
   * Run `code` in the VM using the runtime you passed to this `Devbook`'s constructor as the `env`({@link Env}) parameter.
   * 
   * This {@link Devboook}'s VM shares filesystem and process namespace with other Devbook`s with the same `env`({@link Env}) passed to their constructors.
   * 
   * @param code Code to run
   */
  runCode(code: string) {
    const command = templates[this.opts.env].toCommand(code)
    this.runCmd(command)
  }

  /**
   * Disconnect this Devbook from the VM.
   */
  destroy() {
    this.context.destroy()
    this.isDestroyed = true
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
