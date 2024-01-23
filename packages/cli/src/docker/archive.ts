import * as tar from 'tar-fs'
import * as path from 'path'
import { asLocal } from '../utils/format'

export interface FilePath {
  path: string
  rootPath: string
  name: string
}

export interface FileRewrite {
  oldPath: string
  newPath: string
}

export async function createBlobFromFiles(
  root: string,
  filePaths: FilePath[],
  rewrites: FileRewrite[],
  maxSizeBytes: number = 1024 * 1024 * 1024, // 1 GiB
) {
  const absoluteRewrites = rewrites.map(({ oldPath, newPath }) => ({
    oldPath: path.join(path.sep, oldPath),
    newPath: path.join(path.sep, newPath),
  }))

  const blob = await new Promise<Blob>((resolve, reject) => {
    const chunks: BlobPart[] = []
    let size =  0

    const pack = tar.pack(root, {
      entries: filePaths
        .filter(f =>
          absoluteRewrites.every(({ oldPath }) => path.resolve(oldPath) !== f.path),
        )
        .map(({ rootPath }) => rootPath),
      map: header => {
        const rewrite = absoluteRewrites.find(({ oldPath }) => header.name === oldPath)
        if (rewrite) {
          header.name = rewrite.newPath
        }
        return header
      },
    })

    pack.on('data', (chunk: BlobPart) => {
      if (typeof chunk === 'object') {
        if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk)) {
          size += chunk.byteLength;
        } else {
          size += chunk.size;
        }
      } else {
        size += String(chunk).length;
      }

      if (size > maxSizeBytes) {
        reject(new Error(`Content size is too big. The maximum size is ${asLocal(`${maxSizeBytes / 1024 / 1024} MiB.`)}\n\nCheck if you are not including unnecessary files in the build context (e.g. node_modules)`));
      }
      chunks.push(chunk)
    })

    pack.on('end', () => {
      const blob = new Blob(chunks)
      resolve(blob)
    })

    pack.on('error', (error: any) => {
      reject(new Error(`Error creating tar blob: ${error.message}`))
    })
  })

  return blob
}
