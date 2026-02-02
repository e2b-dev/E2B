import * as fs from 'fs'

const SHELL_SAFE_RE = /^[A-Za-z0-9_@%+=:,./-]+$/

export const shellQuote = (arg: string): string => {
  if (arg === '') {
    return "''"
  }
  if (SHELL_SAFE_RE.test(arg)) {
    return arg
  }
  return `'${arg.replace(/'/g, `'\"'\"'`)}'`
}

export const buildCommand = (commandParts: string[]): string => {
  if (commandParts.length === 1) {
    return commandParts[0]
  }

  return commandParts.map(shellQuote).join(' ')
}

type StatLike = { isFIFO: () => boolean }
type FsLike = { fstatSync: (fd: number) => StatLike }

export const isPipedStdin = (fd = 0, fsModule: FsLike = fs as FsLike) => {
  try {
    const stdinStats = fsModule.fstatSync(fd)
    return stdinStats.isFIFO()
  } catch {
    return false
  }
}

type ReadStdinOptions = {
  fd?: number
  fsModule?: FsLike
  stream?: NodeJS.ReadableStream
}

export const readStdinIfPiped = async (
  options: ReadStdinOptions = {}
): Promise<string | undefined> => {
  const fd = options.fd ?? 0
  const fsModule = options.fsModule ?? (fs as FsLike)
  if (!isPipedStdin(fd, fsModule)) {
    return undefined
  }
  const stream = options.stream ?? process.stdin
  return await readStdinFrom(stream)
}

export const chunkStringByBytes = (
  data: string,
  maxBytes: number
): string[] => {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be greater than 0')
  }

  const chunks: string[] = []
  let current = ''
  let currentBytes = 0

  for (const ch of data) {
    const chBytes = Buffer.byteLength(ch)
    if (currentBytes > 0 && currentBytes + chBytes > maxBytes) {
      chunks.push(current)
      current = ''
      currentBytes = 0
    }
    current += ch
    currentBytes += chBytes
  }

  if (currentBytes > 0 || data.length === 0) {
    chunks.push(current)
  }

  return chunks
}

export async function readStdinFrom(
  stream: NodeJS.ReadableStream
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString()))
    stream.on('error', reject)
  })
}
