import {
  useCallback,
  useEffect,
} from 'react'
import clsx from 'clsx'

import FilesystemPrimitive, {
  DirNode,
  FileNode,
  NodeType,
  SelectHandler,
  useFilesystem,
} from '../../filesystem'

import Dir from './Dir'
import File from './File'


export interface FileInfo {
  isDir: boolean
  name: string
}

export interface Props {
  className?: string
  // Path where we should mount the filesytem.
  rootPath: string
  ignore?: string[]
  onFiletreeClick?: (path: string, type: NodeType) => void
  fetchContent: (dirpath: string) => (FileInfo & { id?: string })[]
}

function Filesystem({
  className,
  rootPath,
  ignore,
  fetchContent,
  onFiletreeClick,
}: Props) {
  const fs = useFilesystem({ rootPath })

  const fetchDirContent = useCallback(async (dirpath: string) => {
    const files = fetchContent(dirpath)
    const ns = files.map(f => (f.isDir
      ? new DirNode({ name: f.name })
      : new FileNode({
        name: f.name, metadata: {
          href: {
            pathname: '/',
            query: {
              view: 'logs',
              logFileID: f.id,
            }
          }
        }
      })))

    fs.add(dirpath, ns, ignore)
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
      rounded-lg
    ">
      <FilesystemPrimitive.Tree
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
        file={File}
        fs={fs}
        onSelect={handleNodeSelect}
      />
    </div>
  )
}

export default Filesystem
