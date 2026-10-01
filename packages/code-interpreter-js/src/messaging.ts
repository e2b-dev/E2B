import { NotFoundError, SandboxError, TimeoutError } from 'e2b'
import { ChartTypes } from './charts'

export async function extractError(res: Response) {
  if (res.ok) {
    return
  }

  switch (res.status) {
    case 502:
      return new TimeoutError(
        `${await res.text()}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
      )
    case 404:
      return new NotFoundError(await res.text())
    default:
      return new SandboxError(`${res.status} ${res.statusText}`)
  }
}

/**
 * Represents an output message from the sandbox code execution.
 */
export class OutputMessage {
  constructor(
    /**
     * The output line.
     */
    public readonly line: string,
    /**
     * Unix epoch in nanoseconds.
     */
    public readonly timestamp: number,
    /**
     * Whether the output is an error.
     */
    public readonly error: boolean
  ) {}

  public toString() {
    return this.line
  }
}

/**
 * Represents an error that occurred during the execution of a cell.
 * The error contains the name of the error, the value of the error, and the traceback.
 */
export class ExecutionError {
  constructor(
    /**
     * Name of the error.
     **/
    public name: string,
    /**
     * Value of the error.
     **/
    public value: string,
    /**
     * The raw traceback of the error.
     **/
    public traceback: string
  ) {}
}

/**
 * Represents a MIME type.
 */
export type MIMEType = string

type E2BData = {
  data: Record<string, unknown>
  chart: ChartTypes
}

/**
 * Dictionary that maps MIME types to their corresponding representations of the data.
 */
export type RawData = {
  [key: MIMEType]: string
} & E2BData

/**
 * Represents the data to be displayed as a result of executing a cell in a Jupyter notebook.
 * The result is similar to the structure returned by ipython kernel: https://ipython.readthedocs.io/en/stable/development/execution.html#execution-semantics
 *
 *
 * The result can contain multiple types of data, such as text, images, plots, etc. Each type of data is represented
 * as a string, and the result can contain multiple types of data. The display calls don't have to have text representation,
 * for the actual result the representation is always present for the result, the other representations are always optional.
 */
export class Result {
  /**
   * Text representation of the result.
   */
  readonly text?: string
  /**
   * HTML representation of the data.
   */
  readonly html?: string
  /**
   * Markdown representation of the data.
   */
  readonly markdown?: string
  /**
   * SVG representation of the data.
   */
  readonly svg?: string
  /**
   * PNG representation of the data.
   */
  readonly png?: string
  /**
   * JPEG representation of the data.
   */
  readonly jpeg?: string
  /**
   * PDF representation of the data.
   */
  readonly pdf?: string
  /**
   * LaTeX representation of the data.
   */
  readonly latex?: string
  /**
   * JSON representation of the data.
   */
  readonly json?: string
  /**
   * JavaScript representation of the data.
   */
  readonly javascript?: string
  /**
   * Contains the data from DataFrame.
   */
  readonly data?: Record<string, unknown>
  /**
   * Contains the chart data.
   */
  readonly chart?: ChartTypes
  /**
   * Extra data that can be included. Not part of the standard types.
   */
  readonly extra?: any

  readonly raw: RawData

  constructor(
    rawData: RawData,
    public readonly isMainResult: boolean
  ) {
    const data = { ...rawData }
    delete data['type']
    delete data['is_main_result']

    this.text = data['text']
    this.html = data['html']
    this.markdown = data['markdown']
    this.svg = data['svg']
    this.png = data['png']
    this.jpeg = data['jpeg']
    this.pdf = data['pdf']
    this.latex = data['latex']
    this.json = data['json']
    this.javascript = data['javascript']
    this.isMainResult = isMainResult
    this.raw = data

    this.data = data['data']
    this.chart = data['chart']

    this.extra = {}

    for (const key of Object.keys(data)) {
      if (
        ![
          'plain',
          'html',
          'markdown',
          'svg',
          'png',
          'jpeg',
          'pdf',
          'latex',
          'json',
          'javascript',
          'data',
          'chart',
          'extra',
          'text',
        ].includes(key)
      ) {
        this.extra[key] = data[key]
      }
    }
  }

  /**
   * Returns all the formats available for the result.
   *
   * @returns Array of strings representing the formats available for the result.
   */
  formats(): string[] {
    const formats = []
    if (this.html) {
      formats.push('html')
    }
    if (this.markdown) {
      formats.push('markdown')
    }
    if (this.svg) {
      formats.push('svg')
    }
    if (this.png) {
      formats.push('png')
    }
    if (this.jpeg) {
      formats.push('jpeg')
    }
    if (this.pdf) {
      formats.push('pdf')
    }
    if (this.latex) {
      formats.push('latex')
    }
    if (this.json) {
      formats.push('json')
    }
    if (this.javascript) {
      formats.push('javascript')
    }
    if (this.data) {
      formats.push('data')
    }

    for (const key of Object.keys(this.extra)) {
      formats.push(key)
    }

    return formats
  }

  /**
   * Returns the serializable representation of the result.
   */
  toJSON() {
    return {
      text: this.text,
      html: this.html,
      markdown: this.markdown,
      svg: this.svg,
      png: this.png,
      jpeg: this.jpeg,
      pdf: this.pdf,
      latex: this.latex,
      json: this.json,
      javascript: this.javascript,
      ...(Object.keys(this.extra).length > 0 ? { extra: this.extra } : {}),
    }
  }
}

/**
 * Data printed to stdout and stderr during execution, usually by print statements, logs, warnings, subprocesses, etc.
 */
export type Logs = {
  /**
   * List of strings printed to stdout by prints, subprocesses, etc.
   */
  stdout: string[]
  /**
   * List of strings printed to stderr by prints, subprocesses, etc.
   */
  stderr: string[]
}

/**
 * Represents the result of a cell execution.
 */
export class Execution {
  constructor(
    /**
     * List of result of the cell (interactively interpreted last line), display calls (e.g. matplotlib plots).
     */
    public results: Result[] = [],
    /**
     * Logs printed to stdout and stderr during execution.
     */
    public logs: Logs = { stdout: [], stderr: [] },
    /**
     * An Error object if an error occurred, null otherwise.
     */
    public error?: ExecutionError,
    /**
     * Execution count of the cell.
     */
    public executionCount?: number
  ) {}

  /**
   * Returns the text representation of the main result of the cell.
   */
  get text(): string | undefined {
    for (const data of this.results) {
      if (data.isMainResult) {
        return data.text
      }
    }
  }

  /**
   * Returns the serializable representation of the execution result.
   */
  toJSON() {
    return {
      results: this.results,
      logs: this.logs,
      error: this.error,
    }
  }
}

export async function parseOutput(
  execution: Execution,
  line: string,
  onStdout?: (output: OutputMessage) => Promise<any> | any,
  onStderr?: (output: OutputMessage) => Promise<any> | any,
  onResult?: (data: Result) => Promise<any> | any,
  onError?: (error: ExecutionError) => Promise<any> | any
) {
  const msg = JSON.parse(line)

  switch (msg.type) {
    case 'result': {
      const result = new Result(
        { ...msg, type: undefined, is_main_result: undefined },
        msg.is_main_result
      )
      execution.results.push(result)
      if (onResult) {
        await onResult(result)
      }
      break
    }
    case 'stdout':
      execution.logs.stdout.push(msg.text)
      if (onStdout) {
        await onStdout({
          error: false,
          line: msg.text,
          timestamp: new Date().getTime() * 1000,
        })
      }
      break
    case 'stderr':
      execution.logs.stderr.push(msg.text)
      if (onStderr) {
        await onStderr({
          error: true,
          line: msg.text,
          timestamp: new Date().getTime() * 1000,
        })
      }
      break
    case 'error':
      execution.error = new ExecutionError(msg.name, msg.value, msg.traceback)
      if (onError) {
        await onError(execution.error)
      }
      break
    case 'number_of_executions':
      execution.executionCount = msg.execution_count
      break
  }
}
