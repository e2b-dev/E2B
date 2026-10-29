import type { ClientApp, ClientConnection } from '@agentclientprotocol/sdk'
import type { Sandbox } from 'e2b'
import {
  startACPTransport,
  type ACPAgentResult,
  type ACPAgentStartOpts,
  type ACPAgentStopOpts,
  type ACPTransport,
} from './transport'

export { DEFAULT_STOP_TIMEOUT_MS } from './transport'
export { DEFAULT_MAX_MESSAGE_BYTES } from './utils'
export type {
  ACPAgentResult,
  ACPAgentStartOpts,
  ACPAgentStopOpts,
  StderrHandler,
} from './transport'

/**
 * ACP agent running in a sandbox, connected to your client.
 */
export class ACPAgent {
  /**
   * @hidden
   * @internal
   */
  constructor(
    private readonly transport: ACPTransport,
    /**
     * Connection to the agent. Use `connection.agent` to initialize, create
     * sessions and send prompts. Closing it also stops the agent.
     */
    readonly connection: ClientConnection
  ) {}

  /**
   * Start an [Agent Client Protocol](https://agentclientprotocol.com) agent in
   * the sandbox and connect your ACP client to it over the agent's stdin/stdout.
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
   * @returns `ACPAgent` with the ACP connection.
   *
   * @throws InvalidArgumentError if `maxMessageBytes` is not a positive integer.
   * @throws SandboxError if the agent could not be started. Later, the
   * connection fails with a `SandboxError` if the agent exits with a non-zero
   * code or sends a message over `maxMessageBytes`.
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
   * const agent = await ACPAgent.start(sandbox, 'goose acp', app)
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
  static async start(
    sandbox: Sandbox,
    command: string,
    client: ClientApp,
    opts?: ACPAgentStartOpts
  ): Promise<ACPAgent> {
    const transport = await startACPTransport(sandbox, command, opts)
    let connection: ClientConnection
    try {
      // Throws if an `onConnect` handler throws.
      connection = client.connect(transport.stream)
    } catch (err) {
      await transport.kill().catch(() => false)
      throw err
    }
    return new ACPAgent(transport, connection)
  }

  /**
   * Process ID of the agent in the sandbox.
   */
  get pid(): number {
    return this.transport.pid
  }

  /**
   * Wait for the agent process to exit.
   *
   * It rejects if the agent's output stream failed before its exit status was known.
   *
   * @returns exit status of the agent.
   */
  async wait(): Promise<ACPAgentResult> {
    return this.transport.wait()
  }

  /**
   * Stop the agent: send EOF to its stdin and kill it if it has not exited
   * within `timeoutMs` of this call. Messages the agent sends after this call
   * are not delivered.
   *
   * @param opts options for stopping the agent.
   *
   * @throws SandboxError if the agent could not be killed.
   */
  async stop(opts?: ACPAgentStopOpts): Promise<void> {
    return this.transport.close(opts)
  }

  /**
   * Kill the agent process with `SIGKILL`.
   *
   * @returns `true` if the agent was killed, `false` if it was not found.
   */
  async kill(): Promise<boolean> {
    return this.transport.kill()
  }
}
