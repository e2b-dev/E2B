import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import RenameLogUploadButton from 'components/RenameLogUploadButton'
import UploadTree from 'components/AgentLogFilesList/UploadFiletree'
import { useRenameLogUpload } from 'hooks/useRenameLogUpload'
import { LiteLogFile } from 'utils/agentLogs'
import { SupabaseClient, useSupabaseClient } from '@supabase/auth-helpers-react'
import { Database } from 'db/supabase'
import { formatLogFileContent } from 'utils/formatLogFileContent'
import { log_uploads } from 'db/prisma'

async function getUploadLogsContent(client: SupabaseClient<Database>, logUploadID: string) {
  const result = await client
    .from('log_files')
    .select('id, content, relativePath, filename')
    .eq('log_upload_id', logUploadID)

  if (result.error) {
    throw new Error(`failed to fetch log files for upload ${logUploadID} - ${result.error.message}`)
  }

  return result.data
}

export interface Props {
  logUpload: log_uploads
  onSelectLogFile: (logFile: LiteLogFile) => void
  selectedLogFile?: LiteLogFile
}

function UploadedLogsDetail({ logUpload, onSelectLogFile, selectedLogFile }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const renameLogUpload = useRenameLogUpload()
  const [uploadName, setUploadName] = useState(logUpload.display_name || `Upload from ${logUpload.created_at.toLocaleString()}`)
  const [isRenaming, setIsRenaming] = useState(false)
  const client = useSupabaseClient()

  const [logFiles, setLogFiles] = useState<{
    id: string;
    content: string;
    relativePath: string;
    filename: string;
  }[]>()

  const openLogFile = logUpload.id === selectedLogFile?.log_upload_id && logFiles ? selectedLogFile : undefined

  useEffect(function openIfLogFile() {
    if (logUpload.id !== selectedLogFile?.log_upload_id) return
    setIsOpen(true)
  }, [logUpload.id, selectedLogFile?.log_upload_id])

  useEffect(function fetchLogFiles() {
    if (!isOpen) return
    getUploadLogsContent(client, logUpload.id).then(f => {
      setLogFiles(
        f
          .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
          .map(f => ({
            ...f,
            ...formatLogFileContent(f),
          }))
      )
    })
  }, [isOpen, client, logUpload])

  useEffect(function handleLogFileSelection() {
    const id = router.query.logFileID
    if (!id) return
    if (!logFiles) return
    const logFile = logFiles.find(f => f.id === id)
    if (!logFile) return
    onSelectLogFile({
      ...logFile,
      log_upload_id: logUpload.id,
    })
    setIsOpen(true)
  }, [router.query, logUpload, onSelectLogFile, logFiles])

  async function handleRenameLogUpload() {
    const newName = prompt('Enter a new name for the logs')
    if (!newName) return

    const oldName = uploadName
    setUploadName(newName)
    try {
      setIsRenaming(true)
      await renameLogUpload({ logUploadID: logUpload.id, displayName: newName })
    } catch (err) {
      console.error(`failed to rename log upload ${logUpload.id}`, err)
      setUploadName(oldName)
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col space-y-2 flex-1">
        <div className="flex items-center space-x-2">
          <button
            className={clsx(
              'h-6 w-6 flex items-center justify-center px-1 cursor-pointer hover:bg-[#6366F1] transition-all rounded-md',
              {
                'bg-[#6366F1] text-gray-200': isOpen,
                'bg-[#1F2437] text-gray-200': !isOpen,
              },
            )}
            onClick={() => setIsOpen(o => !o)}
          >
            <ChevronRight size={14} className={clsx(
              'transition-all',
              'select-none',
              { 'rotate-90': isOpen },
            )} />
          </button>

          <RenameLogUploadButton
            isRenaming={isRenaming}
            onClick={handleRenameLogUpload}
          />

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
            {uploadName}
          </span>
        </div>

        {isOpen && (
          <div className="flex flex-col space-y-3 border-l border-white/5 pl-2 ml-[11px] flex-1">
            <UploadTree
              logUpload={logUpload}
              selectedLogFile={openLogFile}
              logFiles={logFiles || []}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default UploadedLogsDetail
