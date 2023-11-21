import { Sandbox, SandboxOpts } from '../sandbox'


export abstract class BaseTemplate extends Sandbox {


  /**
   * Creates a new Sandbox from the default `base` sandbox template.
   * @returns New Sandbox
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * ```
   */
  static async create(): Promise<BaseTemplate>
  /**
   * Creates a new Sandbox from the specified options.
   * @param opts Sandbox options
   * @returns New Sandbox
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create({
   *   id: "sandboxID",
   *   onStdout: console.log,
   * })
   * ```
   */
  static async create(opts: Omit<SandboxOpts, 'id'>): Promise<BaseTemplate>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static override async create(opts?: Omit<SandboxOpts, 'id'>): Promise<BaseTemplate>{
    throw new Error('You have to implement the method create!')
  }

  async installSystemPackages(packageNames: string | string[]) {
    await this.installPackages('sudo apt-get install -y', packageNames)
  }

  protected async _create(opts?: { timeout?: number }) {
    return this._open({ timeout: opts?.timeout })
  }
  protected async installPackages(command: string, packageNames: string | string[]) {
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
