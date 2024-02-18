import { Sandbox, SandboxOpts } from './index'
import { ProcessOpts } from './process'

/**
 * Creates a new sandbox and keeps it alive for the specified time.
 * @param apiKey API key
 * @param keepAliveFor Automatically kill the sandbox after specified number of milliseconds
 * @param opts Sandbox creation options
 * @returns ID of the created sandbox
 */
export async function create({ apiKey }: { apiKey?: string }, { keepAliveFor, ...opts }: Omit<SandboxOpts, 'apiKey'> & { keepAliveFor: number }) {
  const s = await Sandbox.create({ apiKey, ...opts })
  await s.keepAlive(keepAliveFor)
  await s.close()
  return s.id
}

/**
 * Executes a command inside a sandbox.
 * @param apiKey API key
 * @param sandboxID ID of the sandbox in which execute the command
 * @param opts Process options
 * @returns Process' output
 */
export async function exec({ apiKey, sandboxID }: { sandboxID: string, apiKey?: string }, opts: ProcessOpts) {
  const s = await Sandbox.reconnect({ apiKey, sandboxID })
  const result = await s.process.startAndWait({ ...opts })
  await s.close()
  return result
}

/**
 * Kills a sandbox.
 * @param apiKey API key
 * @param sandboxID ID of the sandbox to kill
 */
export function kill({ apiKey, sandboxID }: { sandboxID: string, apiKey?: string }): Promise<void> {
  return Sandbox.kill(sandboxID, apiKey)
}

/**
 * Downloads a file from a sandbox and returns its contents as a byte array.
 * @param apiKey API key
 * @param sandboxID ID of the sandbox from which to download a file
 * @param path Path to a file inside the sandbox to download
 * @returns File's contents as a byte array
 */
export async function downloadFile({ apiKey, sandboxID }: { sandboxID: string, apiKey?: string }, { path }: { path: string }) {
  const s = await Sandbox.reconnect({ apiKey, sandboxID })
  const result = await s.filesystem.readBytes(path)
  await s.close()
  return result
}
