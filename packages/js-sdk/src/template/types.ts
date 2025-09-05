import stripAnsi from 'strip-ansi'

export type Instruction = {
  type: 'COPY' | 'ENV' | 'RUN' | 'WORKDIR' | 'USER'
  args: string[]
  force: boolean
  forceUpload?: boolean
  filesHash?: string
}

export type CopyItem = {
  src: string
  dest: string
  forceUpload?: boolean
  user?: string
  mode?: number
}

export type TemplateType = {
  steps: Instruction[]
  force: boolean
  fromImage?: string
  fromTemplate?: string
  startCmd?: string
  readyCmd?: string
}

export class LogEntry {
  constructor(
    public readonly timestamp: Date,
    public readonly level: 'debug' | 'info' | 'warn' | 'error',
    public readonly message: string,
  ) {
  }

  toString() {
    return `[${this.timestamp.toISOString()}] [${this.level}] ${stripAnsi(
      this.message,
    )}`
  }
}
