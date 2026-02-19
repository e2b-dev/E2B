/**
 * Class for ready check commands.
 */
export class ReadyCmd {
  private cmd: string

  constructor(cmd: string) {
    this.cmd = cmd
  }

  getCmd(): string {
    return this.cmd
  }
}

/**
 * Wait for a port to be listening.
 * Uses `ss` command to check if a port is open and listening.
 *
 * @param port Port number to wait for
 * @returns ReadyCmd that checks for the port
 *
 * @example
 * ```ts
 * import { Template, waitForPort } from 'e2b'
 *
 * const template = Template()
 *   .fromPythonImage()
 *   .setStartCmd('python -m http.server 8000', waitForPort(8000))
 * ```
 */
export function waitForPort(port: number): ReadyCmd {
  const cmd = `ss -tuln | grep :${port}`
  return new ReadyCmd(cmd)
}

/**
 * Wait for a URL to return a specific HTTP status code.
 * Uses `curl` to make HTTP requests and check the response status.
 *
 * @param url URL to check (e.g., 'http://localhost:3000/health')
 * @param statusCode Expected HTTP status code (default: 200)
 * @returns ReadyCmd that checks the URL
 *
 * @example
 * ```ts
 * import { Template, waitForURL } from 'e2b'
 *
 * const template = Template()
 *   .fromNodeImage()
 *   .setStartCmd('npm start', waitForURL('http://localhost:3000/health'))
 * ```
 */
export function waitForURL(url: string, statusCode: number = 200): ReadyCmd {
  const cmd = `curl -s -o /dev/null -w "%{http_code}" ${url} | grep -q "${statusCode}"`
  return new ReadyCmd(cmd)
}

/**
 * Wait for a process with a specific name to be running.
 * Uses `pgrep` to check if a process exists.
 *
 * @param processName Name of the process to wait for
 * @returns ReadyCmd that checks for the process
 *
 * @example
 * ```ts
 * import { Template, waitForProcess } from 'e2b'
 *
 * const template = Template()
 *   .fromBaseImage()
 *   .setStartCmd('./my-daemon', waitForProcess('my-daemon'))
 * ```
 */
export function waitForProcess(processName: string): ReadyCmd {
  const cmd = `pgrep ${processName} > /dev/null`
  return new ReadyCmd(cmd)
}

/**
 * Wait for a file to exist.
 * Uses shell test command to check file existence.
 *
 * @param filename Path to the file to wait for
 * @returns ReadyCmd that checks for the file
 *
 * @example
 * ```ts
 * import { Template, waitForFile } from 'e2b'
 *
 * const template = Template()
 *   .fromBaseImage()
 *   .setStartCmd('./init.sh', waitForFile('/tmp/ready'))
 * ```
 */
export function waitForFile(filename: string): ReadyCmd {
  const cmd = `[ -f ${filename} ]`
  return new ReadyCmd(cmd)
}

/**
 * Wait for a specified timeout before considering the sandbox ready.
 * Uses `sleep` command to wait for a fixed duration.
 *
 * @param timeout Time to wait in milliseconds (minimum: 1000ms / 1 second)
 * @returns ReadyCmd that waits for the specified duration
 *
 * @example
 * ```ts
 * import { Template, waitForTimeout } from 'e2b'
 *
 * const template = Template()
 *   .fromNodeImage()
 *   .setStartCmd('npm start', waitForTimeout(5000)) // Wait 5 seconds
 * ```
 */
export function waitForTimeout(timeout: number): ReadyCmd {
  // convert to seconds, but ensure minimum of 1 second
  const seconds = Math.max(1, Math.floor(timeout / 1000))
  const cmd = `sleep ${seconds}`
  return new ReadyCmd(cmd)
}
