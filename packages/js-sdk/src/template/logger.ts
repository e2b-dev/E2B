import chalk from 'chalk'
import { stripAnsi } from '../utils'

/**
 * Log entry severity levels.
 */
export type LogEntryLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Represents a single log entry from the template build process.
 */
export class LogEntry {
  /**
   * Create a new log entry.
   *
   * @param timestamp When the log entry was created
   * @param level Severity level of the log entry
   * @param message Log message content
   */
  constructor(
    public readonly timestamp: Date,
    public readonly level: LogEntryLevel,
    public readonly message: string
  ) {}

  /**
   * Convert the log entry to a string representation.
   *
   * @returns Formatted log entry string with timestamp, level, and message
   */
  toString() {
    return `[${this.timestamp.toISOString()}] [${this.level}] ${stripAnsi(
      this.message
    )}`
  }
}

/**
 * Special log entry indicating the start of a build process.
 * Used internally to trigger timer display in the logger.
 */
export class LogEntryStart extends LogEntry {
  /**
   * Create a build start log entry.
   *
   * @param timestamp When the build started
   * @param message Start message
   */
  constructor(timestamp: Date, message: string) {
    super(timestamp, 'debug', message)
  }
}

/**
 * Special log entry indicating the end of a build process.
 * Used internally to stop timer display in the logger.
 */
export class LogEntryEnd extends LogEntry {
  /**
   * Create a build end log entry.
   *
   * @param timestamp When the build ended
   * @param message End message
   */
  constructor(timestamp: Date, message: string) {
    super(timestamp, 'debug', message)
  }
}

/**
 * Interval in milliseconds for updating the build timer display.
 * @internal
 */
const TIMER_UPDATE_INTERVAL_MS = 150

/**
 * Default minimum log level to display.
 * @internal
 */
const DEFAULT_LEVEL: LogEntryLevel = 'info'

/**
 * Colored labels for each log level.
 * @internal
 */
const levels: Record<LogEntryLevel, string> = {
  error: chalk.red('ERROR'),
  warn: chalk.hex('#FF4400')('WARN '),
  info: chalk.hex('#FF8800')('INFO '),
  debug: chalk.gray('DEBUG'),
}

/**
 * Numeric ordering of log levels for comparison (lower = less severe).
 * @internal
 */
const level_order: Record<LogEntryLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Internal state for the build logger.
 * @internal
 */
interface DefaultBuildLoggerState {
  /** When the build started (timestamp) */
  startTime: number
  /** Current frame of the loading animation */
  animationFrame: number
  /** Interval timer for updating the display */
  timerInterval: NodeJS.Timeout | undefined
}

class DefaultBuildLogger {
  private minLevel: LogEntryLevel
  private state: DefaultBuildLoggerState

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

  private getInitialState(
    timerInterval?: NodeJS.Timeout
  ): DefaultBuildLoggerState {
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

/**
 * Create a default build logger with animated timer display.
 *
 * This logger displays build progress with:
 * - Colored, formatted log messages
 * - Animated loading indicator
 * - Elapsed time counter
 * - Configurable minimum log level
 *
 * @param options Logger configuration options
 * @param options.minLevel Minimum log level to display (default: 'info')
 * @returns Logger function that accepts LogEntry instances
 *
 * @example
 * ```ts
 * import { Template, defaultBuildLogger } from 'e2b'
 *
 * const template = Template().fromPythonImage()
 *
 * await Template.build(template, {
 *   alias: 'my-template',
 *   onBuildLogs: defaultBuildLogger({ minLevel: 'debug' })
 * })
 * ```
 */
export function defaultBuildLogger(options?: {
  minLevel?: LogEntryLevel
}): (logEntry: LogEntry) => void {
  const buildLogger = new DefaultBuildLogger(options?.minLevel)

  return buildLogger.logger.bind(buildLogger)
}
