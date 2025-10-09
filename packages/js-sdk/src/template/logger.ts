import chalk from 'chalk'
import { stripAnsi } from '../utils'

export type LogEntryLevel = 'debug' | 'info' | 'warn' | 'error'

export class LogEntry {
  constructor(
    public readonly timestamp: Date,
    public readonly level: LogEntryLevel,
    public readonly message: string
  ) {}

  toString() {
    return `[${this.timestamp.toISOString()}] [${this.level}] ${stripAnsi(
      this.message
    )}`
  }
}

export class LogEntryStart extends LogEntry {
  constructor(timestamp: Date, message: string) {
    super(timestamp, 'debug', message)
  }
}

export class LogEntryEnd extends LogEntry {
  constructor(timestamp: Date, message: string) {
    super(timestamp, 'debug', message)
  }
}

const TIMER_UPDATE_INTERVAL_MS = 150

const DEFAULT_LEVEL: LogEntryLevel = 'info'

const levels: Record<LogEntryLevel, string> = {
  error: chalk.red('ERROR'),
  warn: chalk.hex('#FF4400')('WARN '),
  info: chalk.hex('#FF8800')('INFO '),
  debug: chalk.gray('DEBUG'),
}

// Level ordering for comparison (assuming lower = less severe)
const level_order: Record<LogEntryLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

interface BuildLoggerState {
  startTime: number
  animationFrame: number
  timerInterval: NodeJS.Timeout | undefined
}

class BuildLogger {
  private minLevel: LogEntryLevel
  private state: BuildLoggerState

  constructor(minLevel?: LogEntryLevel) {
    this.minLevel = minLevel ?? DEFAULT_LEVEL
    this.state = this.getInitialState()
  }

  logger(logEntry: LogEntry) {
    if (logEntry instanceof LogEntryStart) {
      this.startTimer()
      return
    }

    if (logEntry instanceof LogEntryEnd) {
      clearInterval(this.state.timerInterval)
      return
    }

    // Filter by minimum level
    if (level_order[logEntry.level] < level_order[this.minLevel]) {
      return
    }

    const formattedLine = this.formatLogLine(logEntry)
    process.stdout.write(`${formattedLine}\n`)

    // Redraw the timer line
    this.updateTimer()
  }

  private getInitialState(timerInterval?: NodeJS.Timeout): BuildLoggerState {
    return {
      startTime: Date.now(),
      animationFrame: 0,
      timerInterval: timerInterval,
    }
  }

  private formatTimerLine() {
    const elapsedSeconds = ((Date.now() - this.state.startTime) / 1000).toFixed(
      1
    )
    return `${elapsedSeconds}s`
  }

  private animateStatus() {
    const frames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
    const idx = this.state.animationFrame % frames.length
    return `${frames[idx]}`
  }

  private formatLogLine(line: LogEntry) {
    const timer = this.formatTimerLine().padEnd(5)

    const timestamp = chalk.dim(
      line.timestamp.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    )

    const level = levels[line.level] || levels[DEFAULT_LEVEL]

    const msg = line.message

    return `${timer} | ${timestamp} ${level} ${msg}`
  }

  private startTimer() {
    if (!process.stdout.isTTY) {
      return
    }

    // Start the timer interval
    const timerInterval = setInterval(
      this.updateTimer.bind(this),
      TIMER_UPDATE_INTERVAL_MS
    )

    this.state = this.getInitialState(timerInterval)

    // Initial timer display
    this.updateTimer()
  }

  private updateTimer() {
    if (!process.stdout.isTTY) {
      return
    }

    this.state.animationFrame++
    const jumpingSquares = this.animateStatus()
    process.stdout.write(
      `${jumpingSquares} Building ${this.formatTimerLine()}\r`
    )
  }
}

export function defaultBuildLogger(options?: {
  minLevel?: LogEntryLevel
}): (logEntry: LogEntry) => void {
  const buildLogger = new BuildLogger(options?.minLevel)

  return buildLogger.logger.bind(buildLogger)
}
