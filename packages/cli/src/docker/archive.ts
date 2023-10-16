import * as Blob from 'cross-blob' // Remove cross-blob when dropping node 16 support
import * as tar from 'tar-fs'

export interface FilePath {
  path: string
  rootPath: string
  name: string
}

export async function createBlobFromFiles(root: string, filePaths: FilePath[]) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const chunks: any[] = []

    const pack = tar.pack(root, {
      entries: filePaths.map(({ rootPath }) => rootPath),
    })

    pack.on('data', chunk => {
      chunks.push(chunk)
    })

    pack.on('end', () => {
      const blob = new Blob.default(chunks)
      resolve(blob)
    })

    pack.on('error', error => {
      reject(new Error(`Error creating tar blob: ${error.message}`))
    })
  })

  return blob
}
