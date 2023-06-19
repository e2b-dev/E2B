import { useCallback } from 'react'
import path from 'path-browserify'

import Filesystem, { FileInfo } from 'components/Filesystem'
import { AgentNextActionLog, AgentPromptLogs, LiteLogUpload } from 'utils/agentLogs'
import { FiletreeProvider } from 'hooks/useFiletree'
import { log_files } from 'db/prisma'

export interface Props {
  logUpload: LiteLogUpload
  onFileSelect?: (file: Omit<log_files, 'project_id' | 'type' | 'size' | 'log_upload_id' | 'content' | 'last_modified'> & { content: AgentPromptLogs | AgentNextActionLog }) => void
}

function UploadTree({
  logUpload,
  onFileSelect,
}: Props) {
  const fetchLogDirContent = useCallback<(dirpath: string) => (FileInfo & { id?: string })[]>(dirpath => {
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
      })),
      ...Array.from(childDirs).map(dir => ({
        name: dir,
        isDir: true,
      })),
    ]
    return content
  }, [logUpload])

  return (
    <div className="flex flex-col items-start justify-start">
      <FiletreeProvider>
        <Filesystem
          // onFiletreeClick={(path, type) => {
          //   console.log('select file', path, type)
          //   const pathWithoutLeadingSlash = path.slice(1)
          //   if (type === NodeType.File) {
          //     const file = logUpload.log_files.find(f => f.relativePath === pathWithoutLeadingSlash)
          //     if (file) {
          //       onFileSelect(file)
          //     }
          //   }
          // }}
          rootPath='/'
          fetchContent={fetchLogDirContent}
        />
      </FiletreeProvider>
    </div>
  )
}

export default UploadTree
