import * as Blob from 'cross-blob' // Remove cross-blob when dropping node 16 support
import * as tar from 'tar-fs'

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
  const blob = await new Promise<Blob>((resolve, reject) => {
    const chunks: any[] = []

    const pack = tar.pack(root, {
      entries: filePaths.map(({ rootPath }) => rootPath),
      ignore: (name: string) => rewrites.some(({ oldPath }) => name === oldPath),
      map: header => {
        const rewrite = rewrites.find(({ oldPath }) => header.name === oldPath)
        if (rewrite) {
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
