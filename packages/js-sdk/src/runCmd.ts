import { Session } from './session'

export async function runCmd(command: string, opts?: { apiKey?: string }) {
  const session = await Session.create({
    id: 'Bash',
    apiKey: opts?.apiKey || process.env.E2B_API_KEY || '', // Session.create will throw an error if the API key is not provided so no need to check here
  })

  const proc = await session.process.start({
    cmd: command,
  })
  const out = await proc.finished

  await session.close()

  return {
    stdout: out.stdout,
    stderr: out.stderr,
  }
}
