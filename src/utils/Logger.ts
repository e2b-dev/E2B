type LogID = string | (() => string)

class Logger {
  constructor(
    public readonly logID: LogID,
    // public readonly isEnabled = process.env.NODE_ENV === 'development'
    public readonly isEnabled = false
  ) { }

  private id() {
    if (typeof this.logID === 'function') return this.logID()
    return this.logID
  }

  log(...args: any[]) {
    if (this.isEnabled) {
      console.log(`\x1b[36m[${this.id()}]\x1b[0m`, ...args)
    }
  }

  warn(...args: any[]) {
    if (this.isEnabled) {
      console.warn(`\x1b[36m[${this.id()}]\x1b[0m`, ...args)
    }
  }

  error(...args: any[]) {
    console.error(`\x1b[31m[${this.id()} ERROR]\x1b[0m`, ...args)
  }
}

export default Logger
