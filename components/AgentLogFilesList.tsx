import {
  useRef,
  useState,
} from 'react'


import clsx from 'clsx'
import { useRouter } from 'next/router'

import { useUploadLogs } from 'hooks/useUploadLogs'
import { useDeleteLogs } from 'hooks/useRemoveLogs'
import { log_files } from '@prisma/client'
import LogFolderUploadButton from 'components/LogFolderUploadButton'

export interface Props {
  logFiles: Omit<log_files, 'content'>[]
  initialSelectedLogFileID?: string
  defaultProjectID: string
}

function AgentLogFilesList({
  logFiles,
  initialSelectedLogFileID,
  defaultProjectID,
}: Props) {
  const router = useRouter()
  const [opeDirs, setOpenDirs] = useState<string[]>([])
  // const [selectedLogFileID, setSelectedLogFileID] = useState(initialSelectedLogFileID || '')
  const fileInput = useRef<HTMLInputElement>(null)

  const uploadFiles = useUploadLogs(defaultProjectID)
  const deleteLogs = useDeleteLogs()

  // Log files sorted by relative path into directory "buckets".
  const logFilesInDirs = logFiles
    // Convert the relative path 'a/b/c' to ['a', 'b', 'c']
    .map(lf => ({ ...lf, relativePath: lf.relativePath.split('/') }))
    // Put logs with the same upload ID into separate arrays.
    .reduce((acc: { [uploadID: string]: (typeof lf)[] }, lf) => {
      const uploadID = lf.log_upload_id as string
      if (acc[uploadID]) {
        acc[uploadID].push(lf)
      } else {
        acc[uploadID] = [lf]
      }
      return acc
    }, {})
  // .reduce((acc: { [dir: string]: (typeof lf)[] }, lf) => {
  //   const dir = lf.relativePath[0]
  //   const dirBucket = acc[dir]
  //   if (acc[dir]) {
  //     acc[dir].push(lf)
  //   } else {
  //     acc[dir] = [lf]
  //   }
  //   return acc
  // }, {})
  console.log('logFilesInDirs', logFilesInDirs)


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

  console.log('logFiles', logFiles)

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

      {logFiles.length === 0 && (
        <div
          className="flex items-center justify-center flex-1"
        >
          <LogFolderUploadButton
            onClick={handleClickOnUpload}
          />
        </div>
      )}

      {logFiles.length > 0 && (
        <div className="flex flex-col space-y-4 p-4 sm:p-6 lg:px-8 overflow-auto">

          {logFiles.map((logFile, i) => (
            <div
              key={logFile.id}
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
                  )}
                >
                  {/* {logFile.log_files} */}
                </span>
              </div>

              {/* Uploaded files */}
              {/* {logFile.log_files.map((lu, i) =>
                <div
                  key={lu.id}
                  className="group flex items-center space-x-2"
                >
                  <div
                    className={clsx(
                      'p-1 cursor-pointer hover:bg-gray-700 transition-all rounded-md',
                      opened.includes(idx) && 'bg-gray-700',
                      !opened.includes(idx) && 'bg-gray-800',
                    )}
                    onClick={() => toggle(idx)}
                  >
                    <ChevronRight size={15} className={clsx(
                      'text-gray-400',
                      'transition-all',
                      'select-none',
                      opened.includes(idx) && 'rotate-90',
                    )} />
                  </div>

                  <span
                    className={clsx(
                      'rounded-md',
                      'py-0.5',
                      'px-2',
                      'hover:bg-[#1F2437]',
                      'transition-all',
                      'w-full',
                      'text-sm',
                      'cursor-pointer',
                      'font-mono',
                      opened.includes(idx) && 'bg-[#1F2437]',
                      opened.includes(idx) && 'font-semibold',
                    )}
                    onClick={() => toggle(idx)}
                  >
                    {fn.name}
                  </span>
                </div>
              )} */}
            </div>
          ))}
        </div>
      )}
    </main >
  )
}

export default AgentLogFilesList