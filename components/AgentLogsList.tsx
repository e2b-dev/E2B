import {
  useState,
} from 'react'
import {
  File,
} from 'lucide-react'
import clsx from 'clsx'
import { useRouter } from 'next/router'

import { LogFile } from 'utils/agentLogs'

export interface Props {
  logFiles: LogFile[]
  initialSelectedLogFileID?: string
}

function AgentLogsList({
  logFiles,
  initialSelectedLogFileID,
}: Props) {
  const router = useRouter()
  const [selectedLogFileID, setSelectedLogFileID] = useState(initialSelectedLogFileID || '')

  function toggleSelectedLogFileID(projectID: string) {
    if (selectedLogFileID === projectID) {
      setSelectedLogFileID('')
      router.push('/?view=logs', undefined, { shallow: true })
    } else {
      setSelectedLogFileID(projectID)
      router.push(`/?view=logs&fileID=${projectID}`, undefined, { shallow: true })
    }
  }

  return (
    <main className="overflow-hidden flex flex-col max-h-full">
      <header className="flex items-center justify-between p-4 sm:p-6 lg:px-8">
        <h1 className="text-2xl font-semibold leading-7 text-white">Log Files</h1>
      </header>

      <div className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8">
        {logFiles.map((logFile, i) => (
          <div
            key={logFile.id}
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
              {logFile.name}.json
            </span>
          </div>
        ))}
      </div>
    </main >
  )
}

export default AgentLogsList