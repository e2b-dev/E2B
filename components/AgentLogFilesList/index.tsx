import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import clsx from 'clsx'
import Splitter, { SplitDirection } from '@devbookhq/splitter'

import {
  LiteLogFile,
  LiteLogUpload,
} from 'utils/agentLogs'
import AgentLogFileContent from 'components/AgentLogFileContent'
import { useLocalStorage } from 'hooks/useLocalStorage'

import Upload from './Upload'
import UploadedLogsDetail from './UploadedLogsDetail'

export interface Props {
  logUploads: LiteLogUpload[]
  defaultProjectID: string
}

function AgentLogFilesList({
  logUploads,
  defaultProjectID,
}: Props) {
  const [splitterSizes, setSplitterSizes] = useLocalStorage('log-file-list-splitter', [40, 60])
  const [selectedLogFile, setSelectedLogFile] = useState<LiteLogFile>()

  const setSizes = useCallback((_: number, sizes: number[]) => {
    setSplitterSizes(sizes)
  }, [setSplitterSizes])

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

  return (
    <main className="rounded-md border-white/5 border overflow-hidden pb-6 flex flex-col max-h-full flex-1">
      <header className="flex items-center justify-between py-4 sm:px-6 lg:px-8 border-b border-b-white/5">
        <h1 className="text-2xl font-semibold text-white">Log Files</h1>
        <Upload
          defaultProjectID={defaultProjectID}
        />
      </header>

      {sortedLogUploads.length === 0 && (
        <div className="flex items-center justify-center flex-1">
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
            <div className="flex flex-col sm:px-4 lg:px-8 flex-1 relative space-y-4">
              {sortedLogUploads.map(logUpload => (
                <UploadedLogsDetail
                  logUpload={logUpload}
                  key={logUpload.id}
                  onSelectLogFile={setSelectedLogFile}
                  selectedLogFile={selectedLogFile}
                />
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
