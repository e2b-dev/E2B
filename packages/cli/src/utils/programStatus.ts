/**
 * Program Status Protocol (OSC 7501): tells the terminal whether the CLI is
 * working, waiting on the user, done, or failed.
 * Spec: https://www.superlogical.com/rex/docs/build/program-status
 */

type ProgramState = 'working' | 'done' | 'blocked' | 'error' | 'clear'
type BlockedKind = 'permission' | 'question' | 'auth'

const APP = 'e2b'
const MAX_MSG_BYTES = 2048
// The spec refuses reports whose decoded text contains C0/C1 control characters.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]+/g

function encodeText(text: string): string {
  let buf = Buffer.from(text.replace(CONTROL_CHARS, ' ').trim(), 'utf8')
  if (buf.length > MAX_MSG_BYTES) {
    // Cut back to a UTF-8 character boundary.
    let end = MAX_MSG_BYTES
    while (end > 0 && (buf[end] & 0xc0) === 0x80) end--
    buf = buf.subarray(0, end)
  }
  return buf.toString('base64')
}

function terminalStream(): NodeJS.WriteStream | undefined {
  if (process.stdout.isTTY) return process.stdout
  if (process.stderr.isTTY) return process.stderr
  return undefined
}

export function formatProgramStatus(
  state: ProgramState,
  opts: { msg?: string; kind?: BlockedKind } = {}
): string {
  const pairs = [`state=${state}`]
  if (state !== 'clear') pairs.push(`app=${APP}`)
  if (state === 'blocked' && opts.kind) pairs.push(`kind=${opts.kind}`)
  if (opts.msg && state !== 'clear') pairs.push(`msg=${encodeText(opts.msg)}`)
  return `\x1b]7501;${pairs.join(':')}\x1b\\`
}

/**
 * Reports the CLI's status to the terminal. No-op when neither stdout nor
 * stderr is a terminal, so piped output stays clean.
 */
export function reportProgramStatus(
  state: ProgramState,
  opts: { msg?: string; kind?: BlockedKind } = {}
) {
  terminalStream()?.write(formatProgramStatus(state, opts))
}

/**
 * Reports `blocked` while waiting for the user's answer, then clears it.
 */
export async function whileBlocked<T>(
  kind: BlockedKind,
  msg: string,
  wait: () => Promise<T>
): Promise<T> {
  reportProgramStatus('blocked', { kind, msg })
  try {
    return await wait()
  } finally {
    reportProgramStatus('clear')
  }
}
