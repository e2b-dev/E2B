import { Session, SessionOpts, DownloadFileFormat } from '../session'
import type { ProcessOpts } from '../session/process'
import { FilesystemEvent, FilesystemOperation } from '../session/filesystemWatcher'

class Artifact {
  readonly path: string
  readonly _session: Session

  constructor(path: string, session: Session) {
    this.path = path
    this._session = session
  }

  download(format?: DownloadFileFormat) {
    return this._session.downloadFile(this.path, format)
  }
}

interface RunPythonOpts extends Omit<ProcessOpts, 'cmd'> {
  onArtifact?: (artifact: Artifact) => void
}

const DataAnalysisEnvId = 'Python3-DataAnalysis'

export class DataAnalysis extends Session {
  constructor(opts: Omit<SessionOpts, 'id'>) {
    super({ id: DataAnalysisEnvId, ...opts })
  }

  static async create(opts?: Omit<SessionOpts, 'id'>) {
    return new DataAnalysis({ ...opts })
      .open({ timeout: opts?.timeout })
      .then(async session => {
        if (opts?.cwd) {
          console.log(`Custom cwd for Session set: "${opts.cwd}"`)
          await session.filesystem.makeDir(opts.cwd)
        }
        return session
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
      artifacts: artifacts.map(artifact => new Artifact(artifact, this)),
    }
  }

  async installPythonPackages(packageName: string | string[]) {
    if (Array.isArray(packageName)) {
      packageName = packageName.join(' ')
    }

    const proc = await this.process.start({ cmd: `pip install ${packageName}` })
    await proc.wait()

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }

  async installSystemPackages(packageName: string | string[]) {
    if (Array.isArray(packageName)) {
      packageName = packageName.join(' ')
    }

    const proc = await this.process.start({ cmd: `sudo apt-get install ${packageName}` })
    await proc.wait()

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }
}
