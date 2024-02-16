import { Sandbox, SandboxOpts } from './index'
import { ProcessOpts, ProcessOutput } from './process'

/**
 * Creates a new sandbox.
 * @param lifetime Lifetime of the sandbox in milliseconds
 * @param opts Sandbox options
 * @returns Sandbox ID
 */
export async function create(lifetime: number, opts: SandboxOpts ): Promise<string> {
  const s = await Sandbox.create(opts)
  await s.keepAlive(lifetime)
  await s.close()
  return s.id
}

/**
 * Starts a new process.
 * @overload
 * @param sandboxId Sandbox ID
 * @returns Process output
 */
/**
 * Starts a new process and wait until it finishes.
 * @param sandboxId Sandbox ID
 * @param opts Process options
 * @returns Process output
 */
export async function exec(sandboxId: string, opts: ProcessOpts): Promise<ProcessOutput> {
  const s = await Sandbox.reconnect(sandboxId)
  const result = await s.process.startAndWait(opts)
  await s.close()
  return result
}



/**
 * Kills a sandbox.
 * @param sandboxId Sandbox ID
 */
export async function kill(sandboxId: string): Promise<void> {
  await Sandbox.kill(sandboxId)
}