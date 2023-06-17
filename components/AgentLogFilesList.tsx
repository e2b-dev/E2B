import {
  useRef,
  useState,
} from 'react'
import {
  Upload,
  File,
} from 'lucide-react'
import clsx from 'clsx'
import { useRouter } from 'next/router'

import { useUploadLogs } from 'hooks/useUploadLogs'
import { useDeleteLogs } from 'hooks/useRemoveLogs'
import { LiteLogUpload } from 'pages'
import { log_files } from '@prisma/client'

export interface Props {
  logUploads: LiteLogUpload[]
  initialSelectedLogFileID?: string
  defaultProjectID: string
}

function AgentLogFilesList({
  logUploads,
  initialSelectedLogFileID,
  defaultProjectID,
}: Props) {
  const router = useRouter()
  const [selectedLogFileID, setSelectedLogFileID] = useState(initialSelectedLogFileID || '')
  const fileInput = useRef<any>(null)

  const uploadFiles = useUploadLogs(defaultProjectID)
  const deleteLogs = useDeleteLogs()

  function handleClickOnUpload() {
    // trigger the click event of the file input
    fileInput.current.click()
  }

  async function handleUpload(files: FileList) {
    const logFiles: Pick<log_files, 'content' | 'filename' | 'relativePath' | 'size' | 'last_modified' | 'type'>[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const content = await file.text()

      if (file.name.startsWith('.')) continue

      logFiles.push({
        filename: file.name,
        relativePath: file.webkitRelativePath,
        type: file.type,
        content,
        last_modified: new Date(file.lastModified),
        size: file.size,
      })
    }

    console.log('NEW LOGS', logFiles)
    await uploadFiles(logFiles)
    // Reload to refresh the list of log files
    // router.reload()
  }

  async function handleFileChange(event: any) {
    if (event.target.files.length === 0) return
    console.log('Files', event.target.files)
    await handleUpload(event.target.files)
  }

  const handleDrag = function (e: any) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
    } else if (e.type === 'dragleave') { }
  }

  async function handleDrop(e: any) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      console.log('Files', e.dataTransfer.files)
      await handleUpload(e.dataTransfer.files)
    }
  }

  function toggleSelectedLogFileID(logFileID: string, filename: string) {
    router.push({
      pathname: `/log/${logFileID}`,
      query: {
        filename,
      }
    }, undefined, { shallow: true })
    // if (selectedLogFileID === logFileID) {
    //   router.push(`/log/${logFileID}`, undefined, { shallow: true })
    //   setSelectedLogFileID('')
    //   router.push('/?view=logs', undefined, { shallow: true })
    // } else {
    //   setSelectedLogFileID(logFileID)
    // }
  }

  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <input
        type="file"
        style={{ display: 'none' }}
        ref={fileInput}
        onChange={handleFileChange}
        // @ts-ignore
        directory=""
        webkitdirectory=""
        mozdirectory=""
        multiple
      />
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-white">Log Files</h1>
        <button
          className="p-2 rounded-md bg-[#6366F1] flex items-center space-x-2"
          onClick={handleClickOnUpload}
        >
          <Upload size={14} />
          <span className="text-sm font-medium">Upload log folder</span>
        </button>
      </header>

      {logUploads.length === 0 && (
        <div
          className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8"
          onDrop={handleDrop}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
        >
          <button
            type="button"
            onClick={handleClickOnUpload}
            className="w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-500 p-12 text-center hover:border-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Upload size={48} className="text-gray-500" strokeWidth={1.5} />
            <span className="mt-2 block text-sm font-semibold text-gray-300">Upload log folder</span>
          </button>
        </div>
      )}

      {logUploads.length > 0 && (
        <div className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8 overflow-auto">
          {logUploads.map((logUpload, i) => (
            <div
              key={logUpload.id}
            >
              <div
                className={clsx(
                  'flex items-center space-x-2 p-2 transition-all rounded-md justify-between',
                )}
              >
                <span
                  className={clsx(
                    'text-sm',
                    'font-semibold',
                    selectedLogFileID === logUpload.id && 'font-semibold',
                  )}
                >
                  {logUpload.id}
                </span>
              </div>
              {logUpload.log_files.map((f, i) =>
                <div
                  key={i}
                  className={clsx(
                    'flex items-center space-x-2 p-2 cursor-pointer hover:bg-gray-700 transition-all rounded-md justify-between',
                    selectedLogFileID === f.id && 'bg-gray-700',
                    selectedLogFileID !== f.id && 'bg-gray-800',
                  )}
                >
                  <File size={14} className="text-gray-500" />
                  <span
                    className={clsx(
                      'text-sm',
                      'cursor-pointer',
                      'font-semibold',
                      selectedLogFileID === f.id && 'font-semibold',
                    )}
                    onClick={() => toggleSelectedLogFileID(f.id, f.filename)}
                  >
                    {f.filename}
                  </span>
                  <div
                    className="cursor-pointer"
                    onClick={async () => {
                      try {
                        const res = await deleteLogs(f.id)
                        console.log(res)
                        router.reload()
                      } catch (err) {
                        console.error(err)
                      }
                    }}
                  >
                    Delete
                  </div>
                </div>
              )
              }
            </div>
          ))}
        </div>
      )}
    </main >
  )
}

export default AgentLogFilesList