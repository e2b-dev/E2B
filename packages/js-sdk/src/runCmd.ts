import { Sandbox } from './sandbox'

export async function runCmd(command: string, opts?: { apiKey?: string }) {
  const sandbox = await Sandbox.create({
    apiKey: opts?.apiKey || process?.env?.E2B_API_KEY || '', // Sandbox.create will throw an error if the API key is not provided so no need to check here
  })

  const out = await sandbox.process.startAndWait(command)

  await sandbox.close()

  return {
    stdout: out.stdout,
    stderr: out.stderr,
  }
}
