import {
  useRef,
  useState,
} from 'react'
import {
  File,
} from 'lucide-react'
import clsx from 'clsx'
import { useRouter } from 'next/router'

import { Log, RawFileLog } from 'utils/agentLogs'
import { useUploadLogs } from 'hooks/useUploadLogs'
import { useDeleteLogs } from 'hooks/useRemoveLogs'
import LogFolderUploadButton from 'components/LogFolderUploadButton'

export interface Props {
  logs: Log[]
  initialSelectedLogFileID?: string
  defaultProjectID: string
}

function AgentLogFilesList({
  logs,
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
    const logFiles: RawFileLog[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const content = await file.text()

      logFiles.push({
        filename: file.name,
        content,
        metadata: {
          relativePath: file.webkitRelativePath,
          size: file.size,
          type: file.type,
          timestamp: file.lastModified,
        }
      })
    }
    await uploadFiles(logFiles, {})
    // Reload to refresh the list of log files
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
        <LogFolderUploadButton
          onClick={handleClickOnUpload}
        />
      </header>

      {logs.length > 0 && (
        <div
          className="flex items-center justify-center flex-1"
        >
          <LogFolderUploadButton
            onClick={handleClickOnUpload}
          />
        </div>
      )}

      {logs.length > 0 && (
        <div className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8 overflow-auto">
          {logs.map((log, i) => (
            <div
              key={log.id}
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
                    selectedLogFileID === log.id && 'font-semibold',
                  )}
                >
                  {log.id}
                </span>
                <button
                  className="cursor-pointer"
                  onClick={async () => {
                    try {
                      const res = await deleteLogs(log.id)
                      console.log(res)
                      router.reload()
                    } catch (err) {
                      console.error(err)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              {log.files.map((f, i) =>
                <div
                  key={i}
                  className={clsx(
                    'flex items-center space-x-2 p-2 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                    selectedLogFileID === log.id && 'bg-gray-700',
                    selectedLogFileID !== log.id && 'bg-gray-800',
                  )}
                  onClick={() => toggleSelectedLogFileID(log.id, f.name)}
                >
                  <File size={14} className="text-gray-500" />
                  <span
                    className={clsx(
                      'text-sm',
                      'cursor-pointer',
                      'font-semibold',
                      selectedLogFileID === log.id && 'font-semibold',
                    )}
                  >
                    {f.name}
                  </span>
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