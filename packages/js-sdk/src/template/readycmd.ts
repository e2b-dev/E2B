export class ReadyCmd {
  private cmd: string

  constructor(cmd: string) {
    this.cmd = cmd
  }

  static waitForPort(port: number): ReadyCmd {
    const cmd = `ss -tuln | grep :${port}`
    return new ReadyCmd(cmd)
  }

  static waitForURL(url: string, statusCode: number = 200): ReadyCmd {
    const cmd = `curl -s -o /dev/null -w "%{http_code}" ${url} | grep -q "${statusCode}"`
    return new ReadyCmd(cmd)
  }

  static waitForProcess(processName: string): ReadyCmd {
    const cmd = `pgrep ${processName} > /dev/null`
    return new ReadyCmd(cmd)
  }

  static waitForFile(filename: string): ReadyCmd {
    const cmd = `[ -f ${filename} ]`
    return new ReadyCmd(cmd)
  }

  static waitForTimeout(timeout: number): ReadyCmd {
    // convert to seconds, but ensure minimum of 1 second
    const seconds = Math.max(1, Math.floor(timeout / 1000))
    const cmd = `sleep ${seconds}`
    return new ReadyCmd(cmd)
  }

  getCmd(): string {
    return this.cmd
  }
}
