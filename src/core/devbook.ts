import { makeIDGenerator } from 'src/utils/id'
import {
  Env,
  templates,
} from './constants'
import Runner from './runner'
import { RunningEnvironment } from './runningEnvironment'
import EvaluationContext from './evaluationContext'

const generateExecutionID = makeIDGenerator(6)

interface Opts {
  env: Env
  onStdout?: (stdout: string) => any
  onStderr?: (stderr: string) => any
  onEnvChange?: (env: RunningEnvironment) => any
  debug?: boolean
}

class Devbook {
  private readonly context: EvaluationContext
  private readonly env: Env
  private readonly executionID: string
  private readonly contextID = 'default'

  constructor({
    env,
    onStderr,
    onStdout,
    onEnvChange,
    debug,
  }: Opts) {
    if (!Runner.obj) throw new Error('Runner is not defined')

    this.env = env
    const executionID = generateExecutionID()
    this.executionID = executionID

    this.context = Runner.obj.createContext({
      debug,
      contextID: this.contextID,
      onEnvChange,
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
      templateID: env,
    })
  }

  evaluate(code: string) {
    const command = `${templates[this.env].command}"${code}"`
    this.context.executeCommand({
      templateID: this.env,
      executionID: this.executionID,
      command,
    })
  }
}

export default Devbook
