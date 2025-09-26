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
  ignorePatterns?: string[],
  stackTrace?: string
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

  for (const file of files) {
    if (file.isDirectory()) {
      continue
    }

    // Add relative path to hash calculation
    const relativePath = path.relative(contextPath, file.fullpath())
    hash.update(relativePath)

    // Add stat information to hash calculation
    let stats
    if (file.isSymbolicLink()) {
      stats = fs.lstatSync(file.fullpath())
    } else {
      stats = fs.statSync(file.fullpath())
    }

    hash.update(stats.mode.toString())
    hash.update(stats.uid.toString())
    hash.update(stats.gid.toString())
    hash.update(stats.size.toString())
    hash.update(stats.mtimeMs.toString())

    // Add file content to hash calculation unless it's a symlink
    if (file.isSymbolicLink()) {
      const content = fs.readlinkSync(file.fullpath())
      hash.update(content)
    } else {
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

  const match = firstLine.match(/at ([^:]+):\d+:\d+/)
  if (match) {
    const filePath = match[1]
    return path.dirname(filePath)
  }

  return
}

export function padOctal(mode: number): string {
  return mode.toString(8).padStart(4, '0')
}

export async function tarFileStream(
  fileName: string,
  fileContextPath: string,
  resolveSymlinks: boolean = false
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
  resolveSymlinks: boolean = false
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
