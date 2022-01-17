type LogID = string | (() => string)

class Logger {
  static readonly isEnabled = process.env.NODE_ENV === 'development'

  constructor(
    public readonly logID: LogID,
  ) { }

  private id() {
    if (typeof this.logID === 'function') return this.logID()
    return this.logID
  }

  log(...args: any[]) {
    if (Logger.isEnabled) {
      console.log(`\x1b[36m[${this.id()}]\x1b[0m`, ...args)
    }
  }

  warn(...args: any[]) {
    if (Logger.isEnabled) {
      console.warn(`\x1b[36m[${this.id()}]\x1b[0m`, ...args)
    }
  }

  error(...args: any[]) {
    console.error(`\x1b[31m[${this.id()} ERROR]\x1b[0m`, ...args)
  }
}

export default Logger
