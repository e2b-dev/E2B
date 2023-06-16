import {
  useRef,
  useState,
} from 'react'
import {
  Upload,
  File,
} from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'
import { useRouter } from 'next/router'

import { LogFile, RawFileLog } from 'utils/agentLogs'
import { useUploadLogs } from 'hooks/useUploadLogs'
import { useDeleteLogs } from 'hooks/useRemoveLogs'

export interface Props {
  logFiles: LogFile[]
  initialSelectedLogFileID?: string
  defaultProjectID: string
}

function AgentLogFilesList({
  logFiles,
  initialSelectedLogFileID,
  defaultProjectID,
}: Props) {
  const router = useRouter()
  const [selectedLogFileID, setSelectedLogFileID] = useState(initialSelectedLogFileID || '')
  const fileInput = useRef<any>(null)

  const uploadFiles = useUploadLogs(defaultProjectID)
  const deleteLogs = useDeleteLogs()

  function handleClick() {
    // trigger the click event of the file input
    fileInput.current.click()
  }

  async function handleUpload(files: FileList) {
    const logFiles: RawFileLog[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const content = await file.text()

      logFiles.push({
        filename: file.name,
        content,
        metadata: {
          size: file.size,
          type: file.type,
          timestamp: file.lastModified,
        }
      })
    }

    const logEntry = await uploadFiles(logFiles, {})

    // Reload to refresh the list of 
    router.reload()
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

  function toggleSelectedLogFileID(logFileID: string) {
    if (selectedLogFileID === logFileID) {
      setSelectedLogFileID('')
      router.push('/?view=logs', undefined, { shallow: true })
    } else {
      setSelectedLogFileID(logFileID)
      router.push(`/log/${logFileID}`, undefined, { shallow: true })
    }
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
          onClick={handleClick}
        >
          <Upload size={14} />
          <span className="text-sm font-medium">Upload log file</span>
        </button>
      </header>

      {logFiles.length === 0 && (
        <div
          className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8"
          onDrop={handleDrop}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
        >
          <button
            type="button"
            onClick={handleClick}
            className="w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-500 p-12 text-center hover:border-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Upload size={48} className="text-gray-500" strokeWidth={1.5} />
            <span className="mt-2 block text-sm font-semibold text-gray-300">Upload log file</span>
          </button>
        </div>
      )}

      {logFiles.length > 0 && (
        <div className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8">
          {logFiles.map((logFile, i) => (
            <Link
              key={logFile.id}
              href={`/log/${logFile.id}`}
            >
              <div
                className={clsx(
                  'flex items-center space-x-2 p-2 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                  selectedLogFileID === logFile.id && 'bg-gray-700',
                  selectedLogFileID !== logFile.id && 'bg-gray-800',
                )}
                onClick={() => toggleSelectedLogFileID(logFile.id)}
              >
                <File size={14} className="text-gray-500" />
                <span
                  className={clsx(
                    'text-sm',
                    'cursor-pointer',
                    'font-semibold',
                    selectedLogFileID === logFile.id && 'font-semibold',
                  )}
                  onClick={() => toggleSelectedLogFileID(logFile.id)}
                >
                  {logFile.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main >
  )
}

export default AgentLogFilesList