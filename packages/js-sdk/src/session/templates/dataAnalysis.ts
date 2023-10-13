import { Session, SessionOpts } from '../index.ts'

class DataAnalysis extends Session {
  env_id = 'YI58BPyX5KrK'

  constructor(opts: Omit<SessionOpts, 'id'>) {
    super({ id: this.env_id, ...opts })
    await this.open()
  }

  create(): void {
    throw new Error('Wrong syntax. Use only `new DataAnalysis()`')
  }

  runPython(code: string) {
    const proc = self.process.start({ cmd: `python -c "${code}"` })
    await proc.finished
    return proc.output
  }

  installPythonPackage(packageName: string) {
    const proc = self.process.start({ cmd: `pip install ${packageName}` })
    await proc.finished

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }

  installSystemPackage(packageName: string) {
    const proc = self.process.start({ cmd: `apt-get install ${packageName}` })
    await proc.finished

    if (proc.output.exitCode !== 0) {
      throw new Error(`Failed to install package ${packageName}`)
    }
  }
}
