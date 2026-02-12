import * as fs from 'fs'

const SHELL_SAFE_RE = /^[A-Za-z0-9_@%+=:,./-]+$/

export const shellQuote = (arg: string): string => {
  if (arg === '') {
    return "''"
  }
  if (SHELL_SAFE_RE.test(arg)) {
    return arg
  }
  const q = "'\"'\"'"
  return `'${arg.replace(/'/g, q)}'`
}

export const buildCommand = (commandParts: string[]): string => {
  if (commandParts.length === 1) {
    return commandParts[0]
  }

  return commandParts.map(shellQuote).join(' ')
}

type StatLike = {
  isFIFO?: () => boolean
  isFile?: () => boolean
  isSocket?: () => boolean
  isCharacterDevice?: () => boolean
}
type FsLike = { fstatSync: (fd: number) => StatLike }

export const isPipedStdin = (fd = 0, fsModule: FsLike = fs as FsLike) => {
  try {
    const stdinStats = fsModule.fstatSync(fd)
    // Treat any non-interactive stdin as "piped": FIFO pipes and file redirection (`< file`).
    // Keep this conservative so normal terminal stdin doesn't get eagerly drained.
    if (stdinStats.isCharacterDevice?.()) {
      return false
    }
    return Boolean(
      stdinStats.isFIFO?.() || stdinStats.isFile?.() || stdinStats.isSocket?.()
    )
  } catch {
    return false
  }
}

type ReadStdinOptions = {
  fd?: number
  fsModule?: FsLike
  stream?: NodeJS.ReadableStream
}

type StdinChunk = Uint8Array | Buffer | string

export const readStdinIfPiped = async (
  options: ReadStdinOptions = {}
): Promise<Buffer | undefined> => {
  const fd = options.fd ?? 0
  const fsModule = options.fsModule ?? (fs as FsLike)
  if (!isPipedStdin(fd, fsModule)) {
    return undefined
  }
  const stream = options.stream ?? process.stdin
  return await readStdinFrom(stream)
}

export const chunkBytesBySize = (
  data: Uint8Array,
  maxBytes: number
): Uint8Array[] => {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be greater than 0')
  }

  const chunks: Uint8Array[] = []
  for (let offset = 0; offset < data.length; offset += maxBytes) {
    chunks.push(data.subarray(offset, offset + maxBytes))
  }
  return chunks
}

export async function streamStdinChunks(
  stream: NodeJS.ReadableStream,
  onChunk: (chunk: Uint8Array) => Promise<void | boolean> | void | boolean,
  maxBytes: number
): Promise<void> {
  if (maxBytes <= 0) {
    throw new Error('maxBytes must be greater than 0')
  }

  for await (const rawChunk of stream as AsyncIterable<StdinChunk>) {
    const chunk =
      typeof rawChunk === 'string'
        ? Buffer.from(rawChunk)
        : Buffer.from(rawChunk)

    if (chunk.byteLength === 0) {
      continue
    }

    const pieces = chunkBytesBySize(chunk, maxBytes)
    for (const piece of pieces) {
      const shouldContinue = await onChunk(piece)
      if (shouldContinue === false) {
        return
      }
    }
  }
}

export async function readStdinFrom(
  stream: NodeJS.ReadableStream
): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
