import { TemplateConfig } from 'src/common-ts/TemplateConfig'
import {
  Env,
  templates,
} from 'src/core/constants'
import hash from 'src/utils/hash'

function hashTemplateID(templateID: Env) {
  return hash(templateID)
}

class RunningEnvironment {
  readonly id: string
  readonly template: TemplateConfig

  // `isReady` is true once remote Runner sends the `Environment.StartAck` message.
  isReady = false

  constructor(
    readonly contextID: string,
    readonly templateID: Env,
  ) {
    this.id = `${contextID}_${hashTemplateID(templateID)}`
    this.template = templates[this.templateID]
  }
}

export default RunningEnvironment
