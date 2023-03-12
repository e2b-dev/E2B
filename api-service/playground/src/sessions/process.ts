import {
  OutStderrResponse,
  OutStdoutResponse,
  ProcessManager,
  createSessionProcess,
  Process,
} from '@devbookhq/sdk'

export interface RunProcessParams extends Pick<Parameters<ProcessManager['start']>[0], 'cmd' | 'envVars' | 'rootdir'> { }

export class CachedProcess {
  readonly stdout: OutStdoutResponse[] = []
  readonly stderr: OutStderrResponse[] = []

  private started = false
  process?: Process
  exited?: Promise<void>

  constructor(private readonly manager: ProcessManager) { }

  async start(params: RunProcessParams) {
    if (this.started) throw new Error('Process already started')
    this.started = true

    const stderr: OutStderrResponse[] = []
    const stdout: OutStdoutResponse[] = []

    const process = await createSessionProcess({
      manager: this.manager,
      ...params,
      onStderr: stderr.push,
      onStdout: stdout.push,
    })

    this.process = process
    return process
  }
}
