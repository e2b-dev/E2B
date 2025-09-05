export const ReadyCmd = {
  waitForPort: (port: number) => `ss -tuln | grep :${port}`,
  waitForURL: (url: string, statusCode: number = 200) =>
    `curl -s -o /dev/null -w "%{http_code}" ${url} | grep -q "${statusCode}"`,
  waitForProcess: (processName: string) => `pgrep ${processName} > /dev/null`,
  waitForFile: (filename: string) => `[ -f ${filename} ]`,
  waitForTimeout: (timeout: number) => {
    // convert to seconds, but ensure minimum of 1 second
    const seconds = Math.max(1, Math.floor(timeout / 1000))
    return `sleep ${seconds}`
  },
}
