import * as Blob from 'cross-blob' // Remove cross-blob when dropping node 16 support
import * as tar from 'tar-fs'
import * as path from 'path'

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
) {
  const absoluteRewrites = rewrites.map(({ oldPath, newPath }) => ({
    oldPath: path.join(path.sep, oldPath),
    newPath: path.join(path.sep, newPath),
  }))

  const blob = await new Promise<Blob>((resolve, reject) => {
    const chunks: any[] = []

    const pack = tar.pack(root, {
      entries: filePaths
        .filter(f =>
          absoluteRewrites.every(({ oldPath }) => path.resolve(oldPath) !== f.path),
        )
        .map(({ rootPath }) => rootPath),
      map: header => {
        const rewrite = absoluteRewrites.find(({ oldPath }) => header.name === oldPath)
        if (rewrite) {
          console.log('replacing', header.name, 'with', rewrite.newPath)
          header.name = rewrite.newPath
        }
        return header
      },
    })

    pack.on('data', (chunk: any) => {
      chunks.push(chunk)
    })

    pack.on('end', () => {
      const blob = new Blob.default(chunks)
      resolve(blob)
    })

    pack.on('error', (error: any) => {
      reject(new Error(`Error creating tar blob: ${error.message}`))
    })
  })

  return blob
}
