
export type DownloadFileFormat =
  | 'base64'
  | 'blob'
  | 'buffer'
  | 'arraybuffer'
  | 'text'


export class SandboxFiles {
  constructor(private readonly file_server_url: string) {

  }

  /**
  * URL that can be used to download or upload file to the sandbox via a multipart/form-data POST request.
  * This is useful if you're uploading files directly from the browser.
  * The file will be uploaded to the user's home directory with the same name.
  * If a file with the same name already exists, it will be overwritten.
  */
  get fileUrl(): string {
    // We need to handle the route without any query parameters
  }

  /**
   * Uploads a file to the sandbox.
   * The file will be uploaded to the user's home directory with the same name.
   * If a file with the same name already exists, it will be overwritten.
   *
   * **You can use the {@link Sandbox.fileURL} property and upload file directly via POST multipart/form-data**
   *
   */
  async uploadFile(file: Buffer | Blob, filename: string) {
    const body = new FormData()

    const blob =
      file instanceof Blob
        ? file
        : new Blob([file], { type: 'application/octet-stream' })

    body.append('file', blob, filename)

    // TODO: Ensure the this is bound in this function
    const response = await fetch(this.fileURL, {
      method: 'POST',
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `Failed to upload file ${response.status} - ${response.statusText}: ${text}`,
      )
    }

    return `/home/user/${filename}`
  }

  /**
   * Downloads a file from the sandbox.
   * @param remotePath Path to a file on the sandbox
   * @param format Format of the downloaded file
   * @returns File content
   */
  async downloadFile(remotePath: string, format?: DownloadFileFormat) {
    remotePath = encodeURIComponent(remotePath)

    // TODO: Ensure the this is bound in this function
    const response = await fetch(`${this.fileURL}?path=${remotePath}`)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to download file '${remotePath}': ${text}`)
    }

    switch (format) {
      case 'base64':
        return Buffer.from(await response.arrayBuffer()).toString('base64')
      case 'blob':
        return await response.blob()
      case 'buffer':
        return Buffer.from(await response.arrayBuffer())
      case 'arraybuffer':
        return await response.arrayBuffer()
      case 'text':
        return await response.text()
      default:
        return await response.arrayBuffer()
    }
  }
}