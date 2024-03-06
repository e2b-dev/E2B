import { Sandbox, SandboxOpts } from '../sandbox'
import { ProcessMessage } from '../sandbox/process'
import { randomBytes } from 'crypto'
import wait from '../utils/wait'
import IWebSocket from 'isomorphic-ws'

interface ExecutionError {
  name: string
  value: string
  traceback: string[]
}

interface Result {
  output?: string
  stdout: string[]
  stderr: string[]
  error?: ExecutionError
  display_data: object[]
}

export class CodeInterpreterV2 extends Sandbox {
  private static template = 'code-interpreter-stateful'
  private readonly jupyter_server_token: string
  private jupyter_kernel_id?: string

  /**
   * Use `DataAnalysis.create()` instead.
   *
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(opts: SandboxOpts) {
    super({ template: opts.template || CodeInterpreterV2.template, ...opts })
    this.jupyter_server_token = randomBytes(24).toString('hex')
  }

  /**
   * Creates a new Sandbox from the template.
   * @returns New Sandbox
   */
  static override async create(): Promise<CodeInterpreterV2>
  /**
   * Creates a new Sandbox from the specified options.
   * @param opts Sandbox options
   * @returns New Sandbox
   */
  static override async create(opts: SandboxOpts): Promise<CodeInterpreterV2>
  static override async create(opts?: SandboxOpts) {
    const sandbox = new CodeInterpreterV2({ ...(opts ? opts : {}) })
    await sandbox._open({ timeout: opts?.timeout })
    sandbox.jupyter_kernel_id = await sandbox.startJupyter()
    return sandbox
  }

  private static sendExecuteRequest(code: string) {
    const msg_id = randomBytes(16).toString('hex')
    const session = randomBytes(16).toString('hex')
    return {
      header: {
        msg_id: msg_id,
        username: 'e2b',
        session: session,
        msg_type: 'execute_request',
        version: '5.3',
      },
      parent_header: {},
      metadata: {},
      content: {
        code: code,
        silent: false,
        store_history: false,
        user_expressions: {},
        allow_stdin: false,
      },
    }
  }

  async execPython(
    code: string,
    onStdout?: (out: ProcessMessage) => Promise<void> | void,
    onStderr?: (out: ProcessMessage) => Promise<void> | void,
  ) {
    let resolve: () => void

    const finished = new Promise<void>((r) => {
      resolve = () => r()
    })
    const result: Result = {
      stdout: [],
      stderr: [],
      display_data: [],
    }

    // @ts-ignore
    const ws = await this._connectKernel(result, resolve, onStdout, onStderr)
    ws.send(JSON.stringify(CodeInterpreterV2.sendExecuteRequest(code)))
    await finished

    ws.close()
    return result
  }

  private async startJupyter() {
    await this.process.start(
      `jupyter server --IdentityProvider.token=${this.jupyter_server_token}`,
    )

    const url = `${this.getProtocol()}://${this.getHostname(8888)}`
    const headers = { Authorization: `Token ${this.jupyter_server_token}` }

    let response = await fetch(`${url}/api`, { headers })
    while (!response.ok) {
      await wait(200)
      response = await fetch(`${url}/api`, { headers })
    }

    response = await fetch(`${url}/api/kernels`, { headers, method: 'POST' })
    if (!response.ok) {
      throw new Error(`Error creating kernel: ${response.status}`)
    }

    const kernel = await response.json()
    return kernel.id
  }

  private async _connectKernel(
    result: Result,
    finish: () => void,
    onStdout?: (out: ProcessMessage) => Promise<void> | void,
    onStderr?: (out: ProcessMessage) => Promise<void> | void,
  ) {
    const headers = { Authorization: `Token ${this.jupyter_server_token}` }
    const ws = new IWebSocket(
      `${this.getProtocol('ws')}://${this.getHostname(8888)}/api/kernels/${
        this.jupyter_kernel_id
      }/channels`,
      { headers },
    )

    const opened = new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await opened

    const helperData = {
      input_accepted: false,
      finish,
    }

    ws.onmessage = (e) => {
      this.onMessage(result, helperData, e.data.toString(), {
        onStdout,
        onStderr,
      })
    }

    return ws
  }

  private onMessage(
    result: Result,
    helperData: { input_accepted: boolean; finish: () => void },
    data: string,
    opts?: {
      onStdout?: (out: ProcessMessage) => Promise<void> | void
      onStderr?: (out: ProcessMessage) => Promise<void> | void
    },
  ) {
    const message = JSON.parse(data)
    if (message.msg_type == 'error') {
      result.error = {
        name: message.content.ename,
        value: message.content.evalue,
        traceback: message.content.traceback,
      }
    } else if (message.msg_type == 'stream') {
      if (message.content.name == 'stdout') {
        result.stdout.push(message.content.text)
        if (opts?.onStdout) {
          opts.onStdout({
            line: message.content.text,
            timestamp: new Date().getTime() * 1_000_000,
            error: false,
          })
        }
      } else if (message.content.name == 'stderr') {
          result.stderr.push(message.content.text)
          if (opts?.onStderr) {
            opts.onStderr({
              line: message.content.text,
              timestamp: new Date().getTime() * 1_000_000,
              error: true,
            })
          }
      }
    } else if (message.msg_type == 'display_data') {
      result.display_data.push(message.content.data)
    } else if (message.msg_type == 'execute_result') {
      result.output = message.content.data['text/plain']
    } else if (message.msg_type == 'status') {
      if (message.content.execution_state == 'idle') {
        if (helperData.input_accepted) {
          helperData.finish()
        }
      } else if (message.content.execution_state == 'error') {
        result.error = {
          name: message.content.ename,
          value: message.content.evalue,
          traceback: message.content.traceback,
        }
        helperData.finish()
      }
    } else if (message.msg_type == 'execute_reply') {
      if (message.content.status == 'error') {
        result.error = {
          name: message.content.ename,
          value: message.content.evalue,
          traceback: message.content.traceback,
        }
      } else if (message.content.status == 'ok') {
        return
      }
    } else if (message.msg_type == 'execute_input') {
      helperData.input_accepted = true
    } else {
      console.log('[UNHANDLED MESSAGE TYPE]:', message.msg_type)
    }
  }
}