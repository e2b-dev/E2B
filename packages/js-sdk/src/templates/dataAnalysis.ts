import { DownloadFileFormat, Sandbox, SandboxOpts } from '../sandbox'
import type { ProcessOpts } from '../sandbox/process'
import { FilesystemEvent, FilesystemOperation } from '../sandbox/filesystemWatcher'
import { BaseTemplate } from './baseTemplate'

export class Artifact {
  readonly path: string
  readonly _sandbox: Sandbox

  constructor(path: string, sandbox: Sandbox) {
    this.path = path
    this._sandbox = sandbox
  }

  async download(format?: DownloadFileFormat) {
    return this._sandbox.downloadFile(this.path, format)
  }
}

export interface RunPythonOpts extends Omit<ProcessOpts, 'cmd'> {
  onArtifact?: (artifact: Artifact) => Promise<void> | void;
}

const DataAnalysisTemplateId = 'Python3-DataAnalysis'

export class DataAnalysis extends BaseTemplate {
  constructor(opts: Omit<SandboxOpts, 'id'>) {
    super({ id: DataAnalysisTemplateId, ...opts })
  }

  static override async create(): Promise<DataAnalysis>;
  static override async create(opts?: Omit<SandboxOpts, 'id'>) {
    return await new DataAnalysis({ ...opts })._create(opts)
  }

  async runPython(code: string, opts: RunPythonOpts = {}) {
    const artifacts: string[] = []

    const registerArtifacts = async (event: FilesystemEvent) => {
      if (event.operation === FilesystemOperation.Create) {
        const artifact = new Artifact(event.path, this)
        artifacts.push(event.path)
        await opts.onArtifact?.(artifact)
      }
    }

    const watcher = this.filesystem.watchDir('/home/user/artifacts')
    watcher.addEventListener(registerArtifacts)
    await watcher.start()

    const currentEpoch = new Date().getTime()
    const codefilePath = `/tmp/main-${currentEpoch}.py`
    await this.filesystem.write(codefilePath, code)
    const proc = await this.process.start({
      cmd: `python ${codefilePath}`,
      ...opts,
    })
    await proc.wait()

    await watcher.stop()

    return {
      stdout: proc.output.stdout,
      stderr: proc.output.stderr,
      artifacts: artifacts.map((artifact) => new Artifact(artifact, this)),
    }
  }

  async installPythonPackages(packageNames: string | string[]) {
    await this.installPackages('pip install', packageNames)
  }
}
