import {
  useCallback,
  useEffect,
} from 'react'
import clsx from 'clsx'
import path from 'path-browserify'

import FilesystemPrimitive, {
  DirNode,
  FileNode,
  FileProps,
  NodeType,
  SelectHandler,
  useFilesystem,
} from '../../filesystem'

import Dir from './Dir'
import File from './File'
import { AgentChallengeTag } from 'utils/agentLogs'

export interface FileInfo {
  isDir: boolean
  name: string
  tags: AgentChallengeTag[]
}

export interface Props {
  className?: string
  // Path where we should mount the filesytem.
  rootPath: string
  ignore?: string[]
  onFiletreeClick?: (path: string, type: NodeType) => void
  fetchContent: (dirpath: string) => (FileInfo & { href?: any, id?: string, timestamp?: Date, logUploadID?: string })[]
  expandedPath?: string
  file?: React.ComponentType<FileProps>
}

function Filesystem({
  className,
  rootPath,
  ignore,
  fetchContent,
  onFiletreeClick,
  expandedPath,
  file,
}: Props) {
  const fs = useFilesystem({ rootPath })
  const fetchDirContent = useCallback(async (dirpath: string) => {
    const files = fetchContent(dirpath)
    const ns = files.map(f => (f.isDir
      ? new DirNode({ name: f.name, metadata: { logUploadID: f.logUploadID } })
      : new FileNode({
        name: f.name, metadata: {
          href: f.href,
          id: f.id,
          timestamp: f.timestamp,
        }
      })))

    fs.add(dirpath, ns, ignore)
    files.forEach(f => {
      fs.setMetadata<AgentChallengeTag[]>(path.join(dirpath, f.name), { key: 'tags', value: f.tags })
    })
  }, [
    fs,
    fetchContent,
    ignore,
  ])

  const handleNodeSelect: SelectHandler = useCallback(async (_, node) => {
    const {
      type,
      path,
      metadata,
      isExpanded,
    } = node

    onFiletreeClick?.(path, type)

    // User is closing dir.
    if (isExpanded) return

    if (type === NodeType.Dir) {
      if (!metadata['isWatching']) {
        fs.setMetadata(path, {
          key: 'isWatching',
          value: true,
        })

        if (!fs.hasChildren(path)) {
          fetchDirContent(path)
        }
      }
    } else if (type === NodeType.File) {
      // TODO: Open file
    }
  },
    [
      fs,
      onFiletreeClick,
      fetchDirContent,
    ],)

  useEffect(function expandPath() {
    if (expandedPath) {
      const dir = path.dirname(expandedPath)
      dir.split('/').forEach((v, i, a) => {
        const currentDir = a.slice(0, i + 1).join('/') || '/'
        fetchDirContent(currentDir)
        if (currentDir === '/') return
        fs.setIsDirExpanded(currentDir, true)
      })
    }
  }, [
    fs,
    handleNodeSelect,
    fetchDirContent,
    expandedPath,
  ])

  useEffect(function mountFilesystem() {
    fetchDirContent(rootPath)
  }, [
    rootPath,
    fetchDirContent,
  ])

  return (
    <div className="
      flex
      flex-col
      space-y-2
      w-full
    ">
      <FilesystemPrimitive.Tree
        emptyPlaceholder='Loading...'
        className={clsx(
          'px-1',
          'flex-1',
          'flex',
          'flex-col',
          'space-y-2',
          'lg:space-y-1',
          'overflow-y-auto',
          className,
        )}
        dir={Dir}
        file={file || File}
        fs={fs}
        onSelect={handleNodeSelect}
      />
    </div>
  )
}

export default Filesystem
