import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ChevronRight,
  Edit,
} from 'lucide-react'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import Splitter, { SplitDirection } from '@devbookhq/splitter'

import { log_files } from 'db/prisma'
import { useUploadLogUpload } from 'hooks/useUploadLogUpload'
import { useRenameLogUpload } from 'hooks/useRenameLogUpload'
import LogFolderUploadButton from 'components/LogFolderUploadButton'
import {
  LiteLogUpload,
  LiteLogFile,
} from 'utils/agentLogs'
import Spinner from 'components/Spinner'
import AgentLogFileContent from 'components/AgentLogFileContent'
import UploadTree from './UploadFiletree'
import { useLocalStorage } from 'hooks/useLocalStorage'

export interface Props {
  logUploads: LiteLogUpload[]
  defaultProjectID: string
}

function AgentLogFilesList({
  logUploads,
  defaultProjectID,
}: Props) {
  const [isUploading, setIsUploading] = useState(false)
  const [openLogUploads, setOpenLogUploads] = useState<{ [key: string]: boolean }>({})
  const [selectedLogFile, setSelectedLogFile] = useState<LiteLogFile>()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadFiles = useUploadLogUpload(defaultProjectID)
  const renameLogUpload = useRenameLogUpload()
  const [splitterSizes, setSplitterSizes] = useLocalStorage('log-file-list-splitter', [40, 60])

  // ID of the log upload that is being renamed.
  const [renamingLogUploadID, setIsRenamingLogUploadID] = useState('')

  // Just a helpful object to keep track of the renamed log uploads in the UI.
  const [renamedLogUploads, setRenamedLogUploads] = useState<{ [key: string]: string }>({})

  const setSizes = useCallback((_: number, sizes: number[]) => {
    setSplitterSizes(sizes)
  }, [setSplitterSizes])

  useEffect(function handleLogFileSelection() {
    const id = router.query.logFileID
    if (!id) return
    const logFile = logUploads.flatMap(logUpload => logUpload.log_files).find(f => f.id === id)
    setSelectedLogFile(logFile)
    if (logFile) {
      const logUpload = logUploads.find(lu => lu.log_files.some(f => f.id === id))
      if (logUpload) {
        setOpenLogUploads(prev => ({
          ...prev,
          [logUpload.id]: true,
        }))
      }
    }
  }, [router.query, logUploads, setSelectedLogFile, setOpenLogUploads])

  const sortedLogUploads = useMemo(() => logUploads
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
    }), [logUploads])

  function handleClickOnUpload() {
    // trigger the click event of the file input
    fileInput.current?.click()
  }

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

  function toggleLogUpload(logUploadID: string) {
    if (openLogUploads[logUploadID]) {
      setOpenLogUploads(prev => ({
        ...prev,
        [logUploadID]: false,
      }))
    } else {
      setOpenLogUploads(prev => ({
        ...prev,
        [logUploadID]: true,
      }))
    }
  }

  async function handleRenameLogUpload(logUploadID: string) {
    if (renamingLogUploadID) return

    const newName = prompt('Enter a new name for the logs')
    if (!newName) return


    setIsRenamingLogUploadID(logUploadID)
    try {
      await renameLogUpload({ logUploadID, displayName: newName })
      setRenamedLogUploads(val => ({
        ...val,
        [logUploadID]: newName,
      }))
    } catch (err: any) {
      console.error(`failed to rename log upload ${logUploadID}`)
      console.error(err)
    }
    setIsRenamingLogUploadID('')
  }

  return (
    <main className="rounded-md overflow-hidden flex flex-col max-h-full flex-1">
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
      <header className="flex items-center justify-between px-4 py-2 border-b border-b-white/5">
        <h1 className="text-xl font-semibold text-white">Log Files</h1>
        <LogFolderUploadButton
          onClick={handleClickOnUpload}
          isUploading={isUploading}
        />
      </header>

      {sortedLogUploads.length === 0 && (
        <div
          className="flex items-center justify-center flex-1"
        >
          <p className="text-gray-400 text-lg">No log files uploaded yet</p>
        </div>
      )}

      <div className="my-4 overflow-hidden flex flex-col flex-1">
        {sortedLogUploads.length > 0 && (
          <Splitter
            gutterClassName={clsx(
              'bg-gray-900 hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] px-0.5 rounded-sm group',
            )}
            draggerClassName={clsx(
              'bg-white/5 group-hover:bg-[#6366F1] transition-all delay-75 duration-[400ms] w-0.5 h-full',
            )}
            direction={SplitDirection.Horizontal}
            classes={['flex pr-2 overflow-auto', 'bg-gray-900 flex pl-2']}
            initialSizes={splitterSizes}
            onResizeFinished={setSizes}
            minWidths={[120, 120]}
          >
            <div className="flex flex-col space-y-4 sm:px-4 flex-1">
              {sortedLogUploads.map((logUpload, i) => (
                <div
                  key={logUpload.id}
                >
                  <div
                    className="flex flex-col space-y-2 flex-1"
                  >
                    <div className="flex items-center space-x-2">
                      <button
                        className={clsx(
                          'h-6 w-6 flex items-center justify-center px-1 cursor-pointer hover:bg-[#6366F1] transition-all rounded-md',
                          openLogUploads[logUpload.id] && 'bg-[#6366F1] text-gray-200',
                          !openLogUploads[logUpload.id] && 'bg-[#1F2437] text-gray-200',
                        )}
                        onClick={() => toggleLogUpload(logUpload.id)}
                      >
                        <ChevronRight size={14} className={clsx(
                          // 'text-gray-400',
                          'transition-all',
                          'select-none',
                          openLogUploads[logUpload.id] && 'rotate-90',
                        )} />
                      </button>

                      <button
                        className={clsx(
                          'h-6 w-20 flex items-center justify-center space-x-1 px-1 bg-[#1F2437] transition-all rounded-md text-gray-200 text-xs',
                          renamingLogUploadID === logUpload.id && 'hover:bg-[#1F2437] cursor-not-allowed',
                          renamingLogUploadID !== logUpload.id && 'cursor-pointer hover:bg-[#272D44]',
                        )}
                        onClick={() => handleRenameLogUpload(logUpload.id)}
                      >
                        {renamingLogUploadID === logUpload.id ? (
                          <Spinner
                            className="text-gray-200 transition-all select-none"
                          />
                        ) : (
                          <Edit
                            className="text-gray-200 transition-all select-none"
                            size={14}
                          />
                        )}
                        <span>Rename</span>
                      </button>
                      <span
                        className={clsx(
                          'text-sm',
                          'font-semibold',
                          'text-gray-200',
                          'whitespace-nowrap',
                        )}
                        // This prevents hydration warning for timestamps rendered via SSR
                        suppressHydrationWarning
                      >
                        {logUpload.display_name && !renamedLogUploads[logUpload.id] && logUpload.display_name}
                        {logUpload.display_name && renamedLogUploads[logUpload.id] && renamedLogUploads[logUpload.id]}
                        {!logUpload.display_name && (
                          `Upload from ${logUpload.created_at.toLocaleString()}`
                        )}
                      </span>
                    </div>

                    {openLogUploads[logUpload.id] && (
                      <div className="flex flex-col space-y-3 border-l border-white/5 pl-2 ml-[11px] flex-1">
                        <UploadTree
                          log={logUpload}
                          selectedLogFile={logUpload.id === selectedLogFile?.log_upload_id ? selectedLogFile : undefined}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <AgentLogFileContent
              logFile={selectedLogFile}
            />
          </Splitter>
        )}
      </div>
    </main >
  )
}

export default AgentLogFilesList
