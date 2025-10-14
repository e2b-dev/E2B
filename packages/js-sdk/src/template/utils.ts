import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dynamicGlob, dynamicTar } from '../utils'
import { BASE_STEP_NAME, FINALIZE_STEP_NAME } from './consts'

export function readDockerignore(contextPath: string): string[] {
  const dockerignorePath = path.join(contextPath, '.dockerignore')
  if (!fs.existsSync(dockerignorePath)) {
    return []
  }

  const content = fs.readFileSync(dockerignorePath, 'utf-8')
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

export async function calculateFilesHash(
  src: string,
  dest: string,
  contextPath: string,
  ignorePatterns: string[],
  resolveSymlinks: boolean,
  stackTrace: string | undefined
): Promise<string> {
  const { glob } = await dynamicGlob()
  const srcPath = path.join(contextPath, src)
  const hash = crypto.createHash('sha256')
  const content = `COPY ${src} ${dest}`

  hash.update(content)

  const files = await glob(srcPath, {
    ignore: ignorePatterns,
    withFileTypes: true,
  })

  if (files.length === 0) {
    const error = new Error(`No files found in ${srcPath}`)
    if (stackTrace) {
      error.stack = stackTrace
    }
    throw error
  }

  // Hash stats
  const hashStats = (stats: fs.Stats) => {
    hash.update(stats.mode.toString())
    hash.update(stats.uid.toString())
    hash.update(stats.gid.toString())
    hash.update(stats.size.toString())
    hash.update(stats.mtimeMs.toString())
  }

  for (const file of files) {
    // Add a relative path to hash calculation
    const relativePath = path.relative(contextPath, file.fullpath())
    hash.update(relativePath)

    // Add stat information to hash calculation
    if (file.isSymbolicLink()) {
      // If the symlink is broken, it will return undefined, otherwise it will return a stats object of the target
      const stats = fs.statSync(file.fullpath(), { throwIfNoEntry: false })
      const shouldFollow =
        resolveSymlinks && (stats?.isFile() || stats?.isDirectory())

      if (!shouldFollow) {
        const stats = fs.lstatSync(file.fullpath())

        hashStats(stats)

        const content = fs.readlinkSync(file.fullpath())
        hash.update(content)

        continue
      }
    }

    const stats = fs.statSync(file.fullpath())

    hashStats(stats)

    if (stats.isFile()) {
      const content = fs.readFileSync(file.fullpath())
      hash.update(new Uint8Array(content))
    }
  }

  return hash.digest('hex')
}

/**
 * Get the caller frame
 * @param depth - The depth of the stack trace
 * Levels explained: caller (eg. from class TemplateBase.fromImage) > original caller (eg. template file)
 * @returns The caller frame
 */
export function getCallerFrame(depth: number): string | undefined {
  const stackTrace = new Error().stack
  if (!stackTrace) {
    return
  }

  const lines = stackTrace.split('\n').slice(1) // Skip the this function (getCallerFrame)
  if (lines.length < depth + 1) {
    return
  }

  return lines.slice(depth).join('\n')
}

/**
 * Matches paths like "at <anonymous> (/path/to/file.js:1:1)" or "at /path/to/file.js:1:1"
 * @param line - The line to match
 * @returns The directory of the file
 */
export function matchFileDir(line: string): string | undefined {
  const match = line.match(/\/[^:]+/)
  if (match) {
    const filePath = match[0]
    return path.dirname(filePath)
  }
}

/**
 * Get the caller directory
 * @returns The caller directory
 */
export function getCallerDirectory(depth: number): string | undefined {
  const caller = getCallerFrame(depth + 1) // +1 depth to skip this function (getCallerDirectory)
  if (!caller) {
    return
  }

  const lines = caller.split('\n')
  if (lines.length === 0) {
    return
  }

  const firstLine = lines[0]
  return matchFileDir(firstLine)
}

export function padOctal(mode: number): string {
  return mode.toString(8).padStart(4, '0')
}

export async function tarFileStream(
  fileName: string,
  fileContextPath: string,
  resolveSymlinks: boolean
) {
  const { globSync } = await dynamicGlob()
  const { create } = await dynamicTar()
  const files = globSync(fileName, { cwd: fileContextPath })

  return create(
    {
      gzip: true,
      cwd: fileContextPath,
      follow: resolveSymlinks,
    },
    files
  )
}

export async function tarFileStreamUpload(
  fileName: string,
  fileContextPath: string,
  resolveSymlinks: boolean
) {
  // First pass: calculate the compressed size without buffering
  const sizeCalculationStream = await tarFileStream(
    fileName,
    fileContextPath,
    resolveSymlinks
  )
  let contentLength = 0
  for await (const chunk of sizeCalculationStream as unknown as AsyncIterable<Buffer>) {
    contentLength += chunk.length
  }

  return {
    contentLength,
    uploadStream: await tarFileStream(
      fileName,
      fileContextPath,
      resolveSymlinks
    ),
  }
}

export function getBuildStepIndex(
  step: string,
  stackTracesLength: number
): number {
  if (step === BASE_STEP_NAME) {
    return 0
  }

  if (step === FINALIZE_STEP_NAME) {
    return stackTracesLength - 1
  }

  return Number(step)
}

export function readGCPServiceAccountJSON(
  contextPath: string,
  pathOrContent: string | object
): string {
  if (typeof pathOrContent === 'string') {
    return fs.readFileSync(path.join(contextPath, pathOrContent), 'utf-8')
  }
  return JSON.stringify(pathOrContent)
}
