import React, {
  memo,
  useCallback,
  useMemo,
} from 'react'

import {
  Metadata,
  NodeType,
} from 'filesystem/node'
import { useChildren } from 'hooks/filesystem'
import Dir from 'filesystem/dir'
import DirWrapper, { DirProps } from './DirWrapper'

import Text from 'components/Text'
import { useFiletree } from 'hooks/useFiletree'
import Filesystem from 'filesystem/filesystem'

export type SelectHandler = (
  event: MouseEvent | TouchEvent,
  node: {
    type: NodeType
    name: string
    path: string
    metadata: Metadata
    isSelected: boolean
    isExpanded: boolean
  },
) => void

export interface FileProps {
  fs: Filesystem
  name: string
  path: string
  level: number
  metadata: Metadata
  isSelected: boolean
  onSelect?: SelectHandler
}

export interface Props {
  className?: string
  fs: Filesystem
  file?: React.ComponentType<FileProps>
  dir?: React.ComponentType<DirProps>
  onSelect?: SelectHandler
  emptyPlaceholder?: string
}

function FilesystemTree({
  className,
  fs,
  file,
  dir,
  onSelect,
  emptyPlaceholder = 'Empty directory',
}: Props) {
  const nodeChildren = useChildren(fs, fs.root.path, true)
  const UserFile = useMemo(() => (file ? memo(file) : () => null), [file])
  const UserDir = useMemo(() => (dir ? memo(dir) : () => null), [dir])

  const ft = useFiletree()

  const handleSelect: SelectHandler = useCallback((e, n) => {
    onSelect?.(e, n)
    ft.select({
      type: n.type,
      path: n.path,
    })
  }, [ft, onSelect])

  return (
    <div className={className}>
      {nodeChildren.length === 0 &&
        <Text
          className="text-center text-gray-500"
          size={Text.size.S3}
          text={emptyPlaceholder}
        />
      }

      {nodeChildren.length > 0 && nodeChildren.map(n => (
        <React.Fragment key={n.path}>
          {n.type === NodeType.Dir && (
            <DirWrapper
              dir={UserDir}
              file={UserFile}
              fs={fs}
              isExpanded={(n as Dir).isExpanded}
              isSelected={n.isSelected}
              key={n.path}
              level={n.level}
              metadata={n.metadata}
              name={n.name}
              path={n.path}
              onSelect={handleSelect}
            />
          )}
          {n.type === NodeType.File && (
            <UserFile
              fs={fs}
              isSelected={n.isSelected}
              key={n.path}
              level={n.level}
              metadata={n.metadata}
              name={n.name}
              path={n.path}
              onSelect={handleSelect}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default memo(FilesystemTree)
