import debounce from 'lodash/debounce'

import Logger from 'src/utils/Logger'
import { TemplateConfig } from 'src/common-ts/TemplateConfig'
import { runner, Template, templates } from 'src/core/constants'

export enum OutputSource {
  Stdout,
  Stderr,
}

interface OutputEntry {
  message: string
  source: OutputSource
}

/**
 * DocumentEnvironment contains information about an environment
 * that should be started when a document is opened.
 * Once an environment is running it's represented by an instance of `RunningEnvironment`.
 *
 * Each document may have multiple document environments.
 */
interface DocumentEnvironment {
  /**
   * ID that uniquely identifies an environment in a document.
   * Must be unique accross a document this document environment belongs to.
   */
  id: string
  templateID: Template
}

/**
 * RunningEnvironment represents a instance of `DocumentEnvironment` once running environment is running on the backend.
 */
class RunningEnvironment {
  /**
   * Running environment's ID is made by concatenating an ID of the document where this environment belongs to
   * and of an ID of `DocumentEnvironment` which was passed to the constructor.
   *
   * ID of a running environment on frontend is globally unique and matches the ID of a running environment on the backend.
   */
  readonly id: string
  private readonly logger: Logger

  output: OutputEntry[] = []

  /**
   * A runtime template for this environment.
   */
  readonly template: TemplateConfig

  isReady = false
  // `isReady` is true once remote Runner sends the `RunningEnvironment.StartAck` message.

  get documentEnvID() {
    return this.docEnv.id
  }

  /**
   * Debounce evaluation of code cells in the environment.
   */
  readonly debounceFunction = debounce((f: Function) => f(), runner.EVAL_DELAY)

  constructor(
    private readonly documentID: string,
    private readonly docEnv: DocumentEnvironment,
  ) {
    this.id = `${documentID}_${docEnv.id}`
    this.logger = new Logger(`RunningEnvironment (${this.id})`)
    this.template = templates[this.docEnv.templateID]
  }

  logOutput(message: string, source: OutputSource) {
    this.output.push({ message, source })
  }

  serialize() {
    return {
      id: this.id,
      documentID: this.documentID,
      templateID: this.template.id,
      documentEnvID: this.documentEnvID,
      isReady: this.isReady,
    }
  }

  restart() {
    this.output = []
    this.isReady = false
  }

  async rootDir() {
    return (await this.template).root_dir
  }
}

export type {
  DocumentEnvironment,
}

export {
  RunningEnvironment,
}
