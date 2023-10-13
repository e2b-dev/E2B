import { Session, SessionOpts } from '../session'
import { FilesystemEvent, FilesystemOperation } from '../session/filesystemWatcher'

class Artifact {
  readonly path: string
  readonly _session: Session

  constructor(path: string, session: Session) {
    this.path = path
    this._session = session
  }

  read() {
    return this._session.downloadFile(this.path)
  }
}

const DataAnalysisEnvId = 'Python3-DataAnalysis'

export class DataAnalysis extends Session {
  constructor(opts: Omit<SessionOpts, 'id'>) {
    super({ id: DataAnalysisEnvId, ...opts })
  }

  static async create(opts: Omit<SessionOpts, 'id'>) {
    return new DataAnalysis({ ...opts })
      .open({ timeout: opts?.timeout })
      .then(async session => {
        if (opts.cwd) {
          console.log(`Custom cwd for Session set: "${opts.cwd}"`)
          await session.filesystem.makeDir(opts.cwd)
        }
        return session
      })
  }

  async runPython(code: string) {
    const artifacts: string[] = []

    function registerArtifacts(event: FilesystemEvent) {
      if (event.operation === FilesystemOperation.Create) {
        artifacts.push(event.path)
      }
    }

    const watcher = this.filesystem.watchDir('/tmp')
    await watcher.addEventListener(registerArtifacts)
    await watcher.start()

    const proc = await this.process.start({ cmd: `python -c "${code}"` })
    await proc

    await watcher.stop()

    return {
      stdout: proc.output.stdout,
      stderr: proc.output.stderr,
      artifacts: artifacts.map(artifact => new Artifact(artifact, this)),
    }
  }

  async installPythonPackage(packageName: string) {
    const proc = await this.process.start({ cmd: `pip install ${packageName}` })
    await proc

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }

  async installSystemPackage(packageName: string) {
    const proc = await this.process.start({ cmd: `apt-get install ${packageName}` })
    await proc

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }
}
