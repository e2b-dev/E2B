import { makeIDGenerator } from 'src/utils/id'
import {
  TemplateID,
  templates,
} from './constants'
import Runner from './runner'
import { RunningEnvironment } from './runningEnvironment'
import EvaluationContext from './evaluationContext'
import { SessionStatus } from './session/sessionManager'

const generateExecutionID = makeIDGenerator(6)

interface Opts {
  templateID: TemplateID
  onStdout?: (stdout: string) => any
  onStderr?: (stderr: string) => any
  onEnvChange?: (env: RunningEnvironment) => any
  onSessionChange?: (session: { status: SessionStatus }) => any
  debug?: boolean
}

class Devbook {
  private readonly context: EvaluationContext
  private readonly templateID: TemplateID
  private readonly executionID: string
  private readonly contextID = 'default'

  constructor({
    templateID,
    onStderr,
    onStdout,
    onSessionChange,
    onEnvChange,
    debug,
  }: Opts) {
    if (!Runner.obj) throw new Error('Runner is not defined')

    this.templateID = templateID
    const executionID = generateExecutionID()
    this.executionID = executionID

    this.context = Runner.obj.createContext({
      debug,
      contextID: this.contextID,
      onEnvChange,
      onSessionChange,
      onCmdOut(payload) {
        if (payload.executionID !== executionID) return
        if (payload.stdout !== undefined) {
          onStdout?.(payload.stdout)
        }
        if (payload.stderr !== undefined) {
          onStderr?.(payload.stderr)
        }
      },
    })

    this.context.createRunningEnvironment({
      templateID,
    })
  }

  evaluate(code: string) {
    const command = `${templates[this.templateID].command}"${code}"`
    this.context.executeCommand({
      templateID: this.templateID,
      executionID: this.executionID,
      command,
    })
  }
}

export default Devbook
