import type { ClientApp, ClientConnection } from '@agentclientprotocol/sdk'
import type { Sandbox } from 'e2b'
import { startACPTransport, type ACPTransport } from './transport'
import type {
  ACPAgentResult,
  ACPAgentStartOpts,
  ACPAgentStopOpts,
} from './types'

export { DEFAULT_MAX_MESSAGE_BYTES, DEFAULT_STOP_TIMEOUT_MS } from './consts'
export { ACPError } from './errors'
export type {
  ACPAgentResult,
  ACPAgentStartOpts,
  ACPAgentStopOpts,
  StderrHandler,
} from './types'

/**
 * ACP agent running in a sandbox, connected to your client.
 */
export class ACPAgent {
  private transport?: ACPTransport
  private _connection?: ClientConnection
  private started = false

  /**
   * Create an [Agent Client Protocol](https://agentclientprotocol.com) agent
   * for the sandbox. Call `start()` to run it and connect your ACP client to it
   * over the agent's stdin/stdout.
   *
   * The client filesystem and terminal capabilities are turned off in
   * `initialize`, and agent requests for `fs/*` or `terminal/*` are answered
   * with an error without reaching your client, so the agent edits files and
   * runs commands with its own tools in the sandbox. Network access and MCP
   * servers you pass to the agent are not restricted.
   *
   * @param sandbox sandbox with the agent installed.
   * @param command command that starts the agent in ACP mode, for example `goose acp`.
   * @param client your ACP client app, created with `client()` from
   * `@agentclientprotocol/sdk`. Its handlers answer permission requests and
   * receive the agent's session updates.
   * @param opts options for starting the agent.
   *
   * @example
   * ```ts
   * import { Sandbox } from 'e2b'
   * import { ACPAgent } from '@e2b/acp'
   * import { client, methods, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
   *
   * const app = client().onNotification(methods.client.session.update, ({ params }) => {
   *   console.log(params.update)
   * })
   * const sandbox = await Sandbox.create('goose')
   * const agent = new ACPAgent(sandbox, 'goose acp', app)
   * await agent.start()
   * await agent.connection.agent.request(methods.agent.initialize, {
   *   protocolVersion: PROTOCOL_VERSION,
   * })
   * const { sessionId } = await agent.connection.agent.request(methods.agent.session.new, {
   *   cwd: '/home/user',
   *   mcpServers: [],
   * })
   * await agent.connection.agent.request(methods.agent.session.prompt, {
   *   sessionId,
   *   prompt: [{ type: 'text', text: 'Create hello.py and run it.' }],
   * })
   * await agent.stop()
   * ```
   */
  constructor(
    private readonly sandbox: Sandbox,
    private readonly command: string,
    private readonly client: ClientApp,
    private readonly opts?: ACPAgentStartOpts
  ) {}

  /**
   * Start the agent in the sandbox and connect your ACP client to it.
   *
   * @throws InvalidArgumentError if `maxMessageBytes` is not a positive integer.
   * @throws SandboxError if the agent could not be started. Later, the
   * connection fails with an `ACPError` if the agent exits with a non-zero
   * code or sends a message over `maxMessageBytes`.
   * @throws Error if `start()` was already called.
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('ACP agent was already started')
    }
    this.started = true
    const transport = await startACPTransport(
      this.sandbox,
      this.command,
      this.opts
    )
    try {
      // Throws if an `onConnect` handler throws.
      this._connection = this.client.connect(transport.stream)
    } catch (err) {
      await transport.kill().catch(() => false)
      throw err
    }
    this.transport = transport
  }

  /**
   * Connection to the agent. Use `connection.agent` to initialize, create
   * sessions and send prompts. Closing it also stops the agent.
   */
  get connection(): ClientConnection {
    return this.running().connection
  }

  /**
   * Process ID of the agent in the sandbox.
   */
  get pid(): number {
    return this.running().transport.pid
  }

  /**
   * Wait for the agent process to exit.
   *
   * It rejects if the agent's output stream failed before its exit status was
   * known, for example after a message over `maxMessageBytes`.
   *
   * @returns exit status of the agent.
   */
  async wait(): Promise<ACPAgentResult> {
    return this.running().transport.wait()
  }

  /**
   * Stop the agent: send EOF to its stdin and kill it if it has not exited
   * within `timeoutMs` of this call. Messages the agent sends after this call
   * are not delivered. It does nothing if the agent is not running.
   *
   * @param opts options for stopping the agent.
   *
   * @throws SandboxError if the agent could not be killed.
   */
  async stop(opts?: ACPAgentStopOpts): Promise<void> {
    return this.transport?.close(opts)
  }

  /**
   * Kill the agent process with `SIGKILL`.
   *
   * @returns `true` if the agent was killed, `false` if it was not found or not started.
   */
  async kill(): Promise<boolean> {
    return this.transport?.kill() ?? false
  }

  private running() {
    if (!this.transport || !this._connection) {
      throw new Error('ACP agent is not started, call start() first')
    }
    return { transport: this.transport, connection: this._connection }
  }
}
