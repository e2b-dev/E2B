import {
  OutStderrResponse,
  OutStdoutResponse,
  ProcessManager,
  createSessionProcess,
} from '@devbookhq/sdk'

export interface RunProcessParams extends Pick<Parameters<ProcessManager['start']>[0], 'cmd' | 'envVars' | 'rootdir'> { }

export class CachedProcess {
  readonly stdout: OutStdoutResponse[] = []
  readonly stderr: OutStderrResponse[] = []

  private started = false

  finished = false
  process?: Awaited<ReturnType<typeof createSessionProcess>>

  get response() {
    return {
      stdout: this.stdout,
      stderr: this.stderr,
      finished: this.finished,
      processID: this.process?.processID!,
    }
  }

  constructor(private readonly manager: ProcessManager) { }

  async start(params: RunProcessParams) {
    if (this.started) throw new Error('Process already started')
    this.started = true

    const process = await createSessionProcess({
      manager: this.manager,
      onStderr: (o) => this.stderr.push(o),
      onStdout: (o) => this.stdout.push(o),
      ...params,
    })

    process.exited.finally(() => {
      this.finished = true
    })

    this.process = process
    return process
  }
}
