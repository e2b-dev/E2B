import type { AnyMessage } from '@agentclientprotocol/sdk'
import type { CommandRequestOpts, CommandStartOpts, Sandbox } from 'e2b'

/**
 * Callback for the agent's stderr output.
 */
export type StderrHandler = (data: string) => void | Promise<void>

/**
 * Options for starting an ACP agent in a sandbox.
 */
export interface ACPAgentStartOpts extends Pick<
  CommandStartOpts,
  'cwd' | 'envs' | 'user' | 'requestTimeoutMs' | 'signal'
> {
  /**
   * Callback for the agent's stderr output (logs). The agent's stdout is reserved for the protocol.
   */
  onStderr?: StderrHandler
  /**
   * Maximum size of a single message from the agent in **bytes**.
   *
   * @default 33_554_432 // 32 MiB
   */
  maxMessageBytes?: number
}

/**
 * Options for stopping an ACP agent. `requestTimeoutMs` and `signal` apply to
 * the request that closes the agent's stdin.
 */
export interface ACPAgentStopOpts extends CommandRequestOpts {
  /**
   * Time for the agent to exit after `stop()` is called, in **milliseconds**.
   * It covers sending EOF to the agent's stdin; after it the agent is killed.
   *
   * @default DEFAULT_STOP_TIMEOUT_MS // 5 seconds
   */
  timeoutMs?: number
}

/**
 * Exit status of an ACP agent process.
 */
export interface ACPAgentResult {
  /**
   * Exit code of the agent process.
   */
  exitCode: number
  /**
   * Error message if the process failed.
   */
  error?: string
}

/**
 * Message stream connected to an ACP agent.
 */
export interface ACPStream {
  readable: ReadableStream<AnyMessage>
  writable: WritableStream<AnyMessage>
}

/**
 * The part of `Sandbox` the transport needs.
 */
export type ACPSandbox = Pick<Sandbox, 'commands'>
