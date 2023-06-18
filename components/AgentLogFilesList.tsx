import {
  useRef,
  useState,
} from 'react'
import {
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'
import { useRouter } from 'next/router'

import { log_files } from '@prisma/client'
import { useUploadLogs } from 'hooks/useUploadLogs'
import { useDeleteLogs } from 'hooks/useRemoveLogs'
import LogFolderUploadButton from 'components/LogFolderUploadButton'
import { LiteLogUpload } from 'utils/agentLogs'

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
  const [openedLogUploads, setOpeneLogUploads] = useState<string[]>([])
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const uploadFiles = useUploadLogs(defaultProjectID)
  const deleteLogs = useDeleteLogs()

  const sortedLogUploads = logUploads
    // logUploads sorted by created_at - the newest first
    .sort((a, b) => {
      if (a.created_at > b.created_at) return -1
      if (a.created_at < b.created_at) return 1
      return 0
    })
    // Sort the log_files inside logUploads alphabtetical by relativePath
    .map(logUpload => {
      const sortedLogFiles = logUpload.log_files.sort((a, b) => {
        if (a.relativePath > b.relativePath) return 1
        if (a.relativePath < b.relativePath) return -1
        return 0
      })

      return {
        ...logUpload,
        log_files: sortedLogFiles,
      }
    })


  function handleClickOnUpload() {
    // trigger the click event of the file input
    fileInput.current?.click()
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

    await uploadFiles(logFiles)
    // Reload to refresh the list of log files
    router.reload()
  }

  async function handleFileChange(event: any) {
    if (event.target.files.length === 0) return
    await handleUpload(event.target.files)
  }

  function toggleSelectedLogFileID(logFileID: string, filename: string) {
    router.push({
      pathname: `/log/${logFileID}`,
    }, undefined, { shallow: true })
    // if (selectedLogFileID === logFileID) {
    //   router.push(`/log/${logFileID}`, undefined, { shallow: true })
    //   setSelectedLogFileID('')
    //   router.push('/?view=logs', undefined, { shallow: true })
    // } else {
    //   setSelectedLogFileID(logFileID)
    // }
  }

  function toggleLogUpload(logUploadID: string) {
    if (openedLogUploads.includes(logUploadID)) {
      setOpeneLogUploads(prev => prev.filter(id => id !== logUploadID))
    } else {
      setOpeneLogUploads(prev => [...prev, logUploadID])
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
        allowdirs=""
        multiple
      />
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-white">Log Files</h1>
        <LogFolderUploadButton
          onClick={handleClickOnUpload}
        />
      </header>

      {sortedLogUploads.length === 0 && (
        <div
          className="flex items-center justify-center flex-1"
        >
          <LogFolderUploadButton
            onClick={handleClickOnUpload}
          />
        </div>
      )}

      {sortedLogUploads.length > 0 && (
        <div className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8 overflow-auto">
          {sortedLogUploads.map((logUpload, i) => (
            <div
              key={logUpload.id}
            >
              <div
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={clsx(
                      'p-1 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                      openedLogUploads.includes(logUpload.id) && 'bg-gray-700',
                      !openedLogUploads.includes(logUpload.id) && 'bg-gray-800',
                    )}
                    onClick={() => toggleLogUpload(logUpload.id)}
                  >
                    <ChevronRight size={15} className={clsx(
                      'text-gray-400',
                      'transition-all',
                      'select-none',
                      openedLogUploads.includes(logUpload.id) && 'rotate-90',
                    )} />
                  </div>
                  <span
                    className={clsx(
                      'text-sm',
                      'font-semibold',
                      'text-gray-500',
                    )}
                  >
                    Uploaded at {logUpload.created_at.toLocaleString()}
                  </span>
                </div>

                {openedLogUploads.includes(logUpload.id) && (
                  <div className="flex flex-col space-y-3 border-l border-gray-800 pl-2 ml-[10px]">
                    {logUpload.log_files.map((logFile) => (
                      <span
                        key={logFile.id}
                        className={clsx(
                          'rounded-md',
                          'py-0.5',
                          'px-2',
                          'text-gray-200',
                          'hover:bg-[#1F2437]',
                          'transition-all',
                          'w-full',
                          'text-sm',
                          'cursor-pointer',
                          'font-mono',
                          'flex',
                          'items-center',
                          'space-x-2',
                        )}
                      >
                        <Link
                          href={`/log/${logFile.id}`}
                        >
                          {logFile.relativePath.split('/').map(p => (
                            <span key={p}>{'/ '}{p}</span>
                          ))}
                        </Link>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main >
  )
}

export default AgentLogFilesList