import { Sandbox, SandboxOpts } from '../sandbox'
import type { ProcessOpts } from '../sandbox/process'
import { FilesystemEvent, FilesystemOperation } from '../sandbox/filesystemWatcher'

export class Artifact<S extends DataAnalysis> {
  readonly path: string
  readonly _sandbox: S

  constructor(path: string, sandbox: S) {
    this.path = path
    this._sandbox = sandbox
  }
}

export interface RunPythonOpts<S extends DataAnalysis> extends Omit<ProcessOpts, 'cmd'> {
  onArtifact?: (artifact: Artifact<S>) => Promise<void> | void;
}

export class DataAnalysis extends Sandbox {
  private static template = 'Python3-DataAnalysis'

  /**
   * Use `DataAnalysis.create()` instead.
   * 
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(opts: SandboxOpts) {
    super({ template: opts.template || DataAnalysis.template, ...opts })
  }

  /**
   * Creates a new Sandbox from the template.
   * @returns New Sandbox
   */
  static override async create(): Promise<DataAnalysis>;
  /**
   * Creates a new Sandbox from the specified options.
   * @param opts Sandbox options
   * @returns New Sandbox
   */
  static override async create(opts: SandboxOpts): Promise<DataAnalysis>;
  static override async create(opts?: SandboxOpts) {
    const sandbox = new DataAnalysis({ ...opts ? opts : {} })
    await sandbox._open({ timeout: opts?.timeout })

    return sandbox
  }

  async runPython(code: string, opts: RunPythonOpts<this> = {}): Promise<{
    stdout: string;
    stderr: string;
    artifacts: Artifact<DataAnalysis>[];
  }> {
    const artifacts: string[] = []

    const registerArtifacts = async (event: FilesystemEvent) => {
      if (event.operation === FilesystemOperation.Create) {
        const artifact = new Artifact<this>(event.path, this)
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
    const output = await this.process.startAndWait({
      cmd: `python ${codefilePath}`,
      ...opts,
    })

    await watcher.stop()

    return {
      stdout: output.stdout,
      stderr: output.stderr,
      artifacts: artifacts.map((artifact) => new Artifact<this>(artifact, this)),
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

    const out = await this.process.startAndWait(`${command} ${packageNames}`)

    if (out.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageNames}: ${out.stderr}`)
    }
  }
}
