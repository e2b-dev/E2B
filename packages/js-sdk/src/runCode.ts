import { Session } from './session'

export enum CodeRuntime {
  Node16 = 'Node16',
  Python3 = 'Python3',
}

// Fucntions that sleeps for a given amount of time
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Run code in a sandboxed cloud environment.
 * `runCode` wraps the `Session` class and provides a simple interface for running code in a sandboxed environment
 * without any need to manage lifecycle of the session.
 * `runCode` automatically loads the E2B API key from the `E2B_API_KEY` environment variable.
 *
 * @param runtime The runtime to use when running the code. Can be one of the following:
 * - "Node16"
 * - "Python3"
 *
 * **Let us know if you need support for other runtimes.**
 * @param code The code to run
 * @param opts Optional parameters to pass
 * @returns
 */
export async function runCode(
  runtime: CodeRuntime,
  code: string,
  opts?: { apiKey?: string },
) {
  let binary = ''
  let filepath = ''
  let envID = ''
  switch (runtime) {
    case CodeRuntime.Node16:
      envID = 'Nodejs'
      binary = 'node'
      filepath = '/index.js'
      break
    case CodeRuntime.Python3:
      envID = 'Python3'
      binary = 'python3'
      filepath = '/main.py'
      break
    default:
      throw new Error(
        `The "${runtime}" runtime isn't supported. Please let us know if you need support for this runtime.`,
      )
  }

  const session = await Session.create({
    id: envID,
    apiKey: opts?.apiKey || process.env.E2B_API_KEY || '', // Session.create will throw an error if the API key is not provided so no need to check here
  })

  await session.filesystem.write(filepath, code)

  const codeProc = await session.process.start({
    cmd: `${binary} ${filepath}`,
    onStdout: data => console.log('stdout: ', data.line),
    onStderr: data => console.error('stderr: ', data.line),
  })
  await sleep(3000)
  const out = await codeProc.finished

  await session.close()

  return {
    stdout: out.stdout,
    stderr: out.stderr,
  }
}
