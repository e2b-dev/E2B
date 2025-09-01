import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { dynamicGlob, dynamicTar } from '../utils'

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

export function calculateFilesHash(
  src: string,
  dest: string,
  contextPath: string,
  ignorePatterns?: string[]
): string {
  const { globSync } = dynamicGlob()
  const srcPath = path.join(contextPath, src)
  const hash = crypto.createHash('sha256')
  const content = `COPY ${src} ${dest}`

  hash.update(content)

  const files = globSync(srcPath, {
    ignore: ignorePatterns,
  })

  if (files.length === 0) {
    throw new Error(`No files found in ${srcPath}`)
  }

  for (const file of files) {
    const content = fs.readFileSync(file)
    hash.update(new Uint8Array(content))
  }

  return hash.digest('hex')
}

export function getCallerDirectory(): string | undefined {
  const stackTrace = new Error().stack
  if (!stackTrace) {
    return
  }

  const lines = stackTrace.split('\n')
  const caller = lines[4]

  const match = caller.match(/at ([^:]+):\d+:\d+/)
  if (match) {
    const filePath = match[1]
    return path.dirname(filePath)
  }

  return
}

export function padOctal(mode: number): string {
  return mode.toString(8).padStart(4, '0')
}

export function tarFileStream(fileName: string, fileContextPath: string) {
  const { globSync } = dynamicGlob()
  const { create } = dynamicTar()
  const files = globSync(fileName, { cwd: fileContextPath, nodir: false })

  return create(
    {
      gzip: true,
      cwd: fileContextPath,
    },
    files
  )
}

export async function tarFileStreamUpload(
  fileName: string,
  fileContextPath: string
) {
  // First pass: calculate the compressed size without buffering
  const sizeCalculationStream = tarFileStream(fileName, fileContextPath)
  let contentLength = 0
  for await (const chunk of sizeCalculationStream as unknown as AsyncIterable<Buffer>) {
    contentLength += chunk.length
  }

  return {
    contentLength,
    uploadStream: tarFileStream(fileName, fileContextPath),
  }
}
