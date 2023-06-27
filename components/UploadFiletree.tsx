import { useCallback } from 'react'
import path from 'path-browserify'

import Filesystem, { FileInfo } from 'components/Filesystem'
import { LiteLogFile, LiteLogUpload } from 'utils/agentLogs'
import { FiletreeProvider } from 'hooks/useFiletree'

export interface Props {
  log: LiteLogUpload
  selectedLogFile?: LiteLogFile
}

function UploadTree({
  log: logUpload,
  selectedLogFile,
}: Props) {
  const fetchLogDirContent = useCallback<(dirpath: string) => (FileInfo & { id?: string, logUploadID: string, href?: any })[]>(dirpath => {
    const currentDir = dirpath.slice(1)
    const childFiles = logUpload
      .log_files
      .filter(f => {
        return path.dirname(f.relativePath) === currentDir
      })

    const filesInChildDirs = logUpload
      .log_files
      .filter(f => {
        const fileDir = path.dirname(f.relativePath)
        return fileDir !== currentDir && fileDir.startsWith(currentDir)
      })

    const childDirs = filesInChildDirs.reduce((acc, file) => {
      if (currentDir === '') {
        const fileDir = path.dirname(file.relativePath)
        const childDir = fileDir.split('/')[0]
        return acc.add(childDir)
      }

      const fileDir = path.dirname(file.relativePath)
      const childDirs = fileDir.slice(currentDir.length)
      const childDir = childDirs.split('/')[1]
      return acc.add(childDir)
    }, new Set<string>())

    const content = [
      ...childFiles.map(f => ({
        name: f.filename,
        isDir: false,
        id: f.id,
        tags: [],
        logUploadID: logUpload.id,
        href: {
          pathname: '/',
          query: {
            logFileID: f.id,
          },
        },
      })),
      ...Array.from(childDirs).map(dir => ({
        name: dir,
        isDir: true,
        // Filter out tags that don't belong to this dir.
        tags: logUpload.tags.filter(t => t.path === `/${dir}`),
        logUploadID: logUpload.id,
      })),
    ]
      .sort((a, b) => a.name.localeCompare(b.name))

    return content
  }, [logUpload])

  return (
    <div className="flex flex-col items-start justify-start">
      <FiletreeProvider>
        <Filesystem
          expandedPath={'/' + selectedLogFile?.relativePath}
          rootPath='/'
          fetchContent={fetchLogDirContent}
        />
      </FiletreeProvider>
    </div>
  )
}

export default UploadTree
