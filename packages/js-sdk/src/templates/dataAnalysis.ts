import { DownloadFileFormat, Sandbox, SandboxOpts } from '../sandbox'
import type { ProcessOpts } from '../sandbox/process'
import { FilesystemEvent, FilesystemOperation } from '../sandbox/filesystemWatcher'

class Artifact {
  readonly path: string
  readonly _sandbox: Sandbox

  constructor(path: string, sandbox: Sandbox) {
    this.path = path
    this._sandbox = sandbox
  }

  download(format?: DownloadFileFormat) {
    return this._sandbox.downloadFile(this.path, format)
  }
}

interface RunPythonOpts extends Omit<ProcessOpts, 'cmd'> {
  onArtifact?: (artifact: Artifact) => void;
}

const DataAnalysisEnvId = 'Python3-DataAnalysis'

export class DataAnalysis extends Sandbox {
  constructor(opts: Omit<SandboxOpts, 'id'>) {
    super({ id: DataAnalysisEnvId, ...opts })
  }

  static async create(opts?: Omit<SandboxOpts, 'id'>) {
    return new DataAnalysis({ ...opts })
      .open({ timeout: opts?.timeout })
      .then(async (sandbox) => {
        if (opts?.cwd) {
          console.log(`Custom cwd for Sandbox set: "${opts.cwd}"`)
          await sandbox.filesystem.makeDir(opts.cwd)
        }
        return sandbox
      })
  }

  async runPython(code: string, opts: RunPythonOpts = {}) {
    const artifacts: string[] = []

    const registerArtifacts = (event: FilesystemEvent) => {
      if (event.operation === FilesystemOperation.Create) {
        const artifact = new Artifact(event.path, this)
        artifacts.push(event.path)
        opts.onArtifact?.(artifact)
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

  async installSystemPackages(packageNames: string | string[]) {
    await this.installPackages('sudo apt-get install -y', packageNames)
  }

  private async installPackages(command: string, packageNames: string | string[]) {
    if (Array.isArray(packageNames)) {
      packageNames = packageNames.join(' ')
    }

    packageNames = packageNames.trim()
    if (packageNames.length === 0) {
      return
    }

    const proc = await this.process.start({
      cmd: `${command} ${packageNames}`,
    })
    await proc.wait()

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageNames}: ${proc.output.stderr}`)
    }
  }
}
