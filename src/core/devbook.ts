import { makeIDGenerator } from 'src/utils/id'
import {
  Env,
  templates,
} from './constants'
import Runner from './runner'
import EvaluationContext from './evaluationContext'
import { SessionStatus } from './session/sessionManager'

const generateExecutionID = makeIDGenerator(6)

export enum DevbookStatus {
  Disconnected,
  Connecting,
  WaitingForEnv,
  EnvReady,
  Executing,
}

class Devbook {
  private readonly context: EvaluationContext
  private readonly executionID: string
  private readonly contextID: string

  private _isExecuting = false
  private get isExecuting() {
    return this._isExecuting
  }
  private set isExecuting(value: boolean) {
    this._isExecuting = value
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

  private updateStatus() {
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
          status = DevbookStatus.WaitingForEnv
          break
        }
        if (this.isExecuting) {
          status = DevbookStatus.Executing
          break
        }
        status = DevbookStatus.EnvReady
        break
    }
    this.status = status
  }

  private _status = DevbookStatus.Disconnected
  get status() {
    return this._status
  }

  private set status(value: DevbookStatus) {
    this._status = value
    this.opts.onStatusChange?.(value)
  }

  constructor(private readonly opts: {
    env: Env
    onStdout?: (stdout: string) => void
    onStderr?: (stderr: string) => void
    onStatusChange?: (status: DevbookStatus) => void
    debug?: boolean
  }) {
    const contextID = 'default'
    this.contextID = contextID

    const executionID = generateExecutionID()
    this.executionID = executionID

    const setIsEnvReady = (value: boolean) => this.isEnvReady = value
    const setSessionStatus = (value: SessionStatus) => this.sessionStatus = value
    const setIsExecuting = (value: boolean) => this.isExecuting = value

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
        setIsExecuting(false)
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

  runCmd(command: string) {
    this.isExecuting = true
    this.context.executeCommand({
      templateID: this.opts.env,
      executionID: this.executionID,
      command,
    })
  }

  runCode(code: string) {
    const command = templates[this.opts.env].toCommand(code)
    this.runCmd(command)
  }
}

export default Devbook
