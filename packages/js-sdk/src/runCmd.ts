import { Sandbox } from './sandbox'

export async function runCmd(command: string, opts?: { apiKey?: string }) {
  const sandbox = await Sandbox.create({
    template: 'Bash',
    apiKey: opts?.apiKey || process?.env?.E2B_API_KEY || '', // Sandbox.create will throw an error if the API key is not provided so no need to check here
  })

  const proc = await sandbox.process.start({
    cmd: command,
  })
  const out = await proc.wait()

  await sandbox.close()

  return {
    stdout: out.stdout,
    stderr: out.stderr,
  }
}
