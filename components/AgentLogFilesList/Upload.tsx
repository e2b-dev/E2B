import { useRef, useState } from 'react'

import { useUploadLogUpload } from 'hooks/useUploadLogUpload'
import { log_files } from 'db/prisma'
import { useRouter } from 'next/router'
import LogFolderUploadButton from 'components/LogFolderUploadButton'

export interface Props {
  defaultProjectID: string
}

function Upload({ defaultProjectID }: Props) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFiles = useUploadLogUpload(defaultProjectID)
  const [isUploading, setIsUploading] = useState(false)

  async function handleUpload(files: FileList) {
    const logFiles: Pick<log_files, 'content' | 'filename' | 'relativePath' | 'last_modified'>[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const content = await file.text()

      if (file.name.startsWith('.')) continue

      logFiles.push({
        filename: file.name,
        relativePath: file.webkitRelativePath,
        content,
        last_modified: new Date(file.lastModified),
      })
    }

    await uploadFiles(logFiles)
    // Reload to refresh the list of log files
    router.reload()
  }

  async function handleFileChange(event: any) {
    if (event.target.files.length === 0) return
    setIsUploading(true)
    await handleUpload(event.target.files)
    setIsUploading(false)
  }

  function handleClickOnUpload() {
    // trigger the click event of the file input
    fileInput.current?.click()
  }

  return (
    <>
      <LogFolderUploadButton
        onClick={handleClickOnUpload}
        isUploading={isUploading}
      />
      <input
        type="file"
        style={{ display: 'none' }}
        ref={fileInput}
        onChange={handleFileChange}
        // @ts-ignore
        directory=""
        webkitdirectory=""
        mozdirectory=""
        allowdirs=""
        multiple
      />
    </>
  )
}

export default Upload
