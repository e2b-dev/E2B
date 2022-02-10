import { TemplateConfig } from '../../common-ts/TemplateConfig'
import {
  Env,
  templates,
} from '../constants'
import hash from '../../utils/hash'
import * as envfs from './filesystem'

function hashTemplateID(templateID: Env) {
  return hash(templateID)
}

export enum OutputSource {
  Stdout,
  Stderr,
}

interface OutputEntry {
  message: string
  source: OutputSource
}

class RunningEnvironment {
  readonly id: string
  readonly template: TemplateConfig

  output: OutputEntry[] = []
  readonly filesystem = new envfs.Filesystem()

  // `isReady` is true once remote Runner sends the `Environment.StartAck` message.
  isReady = false

  constructor(
    readonly contextID: string,
    readonly templateID: Env,
  ) {
    this.id = `${contextID}_${hashTemplateID(templateID)}`
    this.template = templates[this.templateID]
  }

  restart() {
    this.output = []
    this.isReady = false
    this.filesystem.setDirsContent([
      { dirPath: '/', content: [] },
    ])
  }

  logOutput(message: string, source: OutputSource) {
    this.output = [...this.output, { message, source }]
  }

  rootDir() {
    return this.template.root_dir
  }
}

export default RunningEnvironment
