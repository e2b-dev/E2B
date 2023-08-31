/* eslint-disable @typescript-eslint/no-explicit-any */
type LogID = string | (() => string)

export const levels = ['debug', 'info', 'warn', 'error']
export const levelsOrNone = [...levels, 'none']
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogLevelOrNone = LogLevel | 'none'

interface Logger {
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
}

const colors = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
}

class Logger {
  constructor(
    public readonly logID: LogID,
    public readonly consoleLogLevel: LogLevelOrNone = 'info',
    public readonly customLogger?: Logger,
  ) {
    if (!levelsOrNone.includes(consoleLogLevel)) {
      throw new Error(
        `Invalid consoleLogLevel: "${consoleLogLevel}", supported values: ${levelsOrNone.join(
          ', ',
        )}, default: "info"`,
      )
    }
  }

  debug(...args: any[]) {
    return this.log('debug', ...args)
  }

  info(...args: any[]) {
    return this.log('info', ...args)
  }

  warn(...args: any[]) {
    return this.log('warn', ...args)
  }

  error(...args: any[]) {
    return this.log('error', ...args)
  }

  private log(level: LogLevel, ...args: any[]) {
    // is there's custom logger, use it
    if (this.customLogger) return this.customLogger[level](...args)

    // if level is lower than consoleLogLevel, don't log
    if (levels.indexOf(level) < levels.indexOf(this.consoleLogLevel)) return
    const color = colors[level]
    const consoleMethod = console[level]
    consoleMethod(`${color}[${this.id()} ${level.toUpperCase()}]\x1b[0m`, ...args)
  }

  private id() {
    if (typeof this.logID === 'function') return this.logID()
    return this.logID
  }
}

export default Logger
