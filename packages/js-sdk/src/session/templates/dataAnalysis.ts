import { Session, SessionOpts } from '../index'

export class DataAnalysis extends Session {
  private envID = 'Python3-DataAnalysis'

  constructor(opts: Omit<SessionOpts, 'id'>) {
    super({ id: this.env_id, ...opts })
    await this.open()
  }

  create(): void {
    throw new Error('Wrong syntax. Use only `new DataAnalysis()`')
  }

  async runPython(code: string) {
    const proc = self.process.start({ cmd: `python -c "${code}"` })
    await proc.finished
    return proc.output
  }

  async installPythonPackage(packageName: string) {
    const proc = self.process.start({ cmd: `pip install ${packageName}` })
    await proc.finished

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }

  async installSystemPackage(packageName: string) {
    const proc = self.process.start({ cmd: `apt-get install ${packageName}` })
    await proc.finished

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }
}
