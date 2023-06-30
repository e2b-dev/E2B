import React, { memo } from 'react'

import Text from 'components/Text'

import {
  Metadata,
  NodeType,
} from '../filesystem/node'
import { useChildren } from '../hooks/filesystem'
import Dir from '../filesystem/dir'
import Filesystem from '../filesystem/filesystem'

import {
  FileProps,
  SelectHandler,
} from './FilesystemTree'

// DirProps are intended for a use by outside users of the Filesystem component.
export type DirProps = Pick<
  Props,
  'fs' |
  'name' |
  'path' |
  'level' |
  'metadata' |
  'isExpanded' |
  'isSelected' |
  'onSelect' |
  'onSelect'
> & { children: React.ReactNode }

export interface Props {
  fs: Filesystem
  path: string
  name: string
  level: number
  metadata: Metadata
  isExpanded: boolean
  isSelected: boolean
  onSelect?: SelectHandler
  file: React.ComponentType<FileProps>
  dir: React.ComponentType<DirProps>
}

const DirWrapper = memo(function ({
  path,
  fs,
  name,
  level,
  metadata,
  onSelect,
  file: UserFile,
  dir: UserDir,
  isExpanded,
  isSelected,
}: Props) {
  const nodeChildren = useChildren(fs, path, isExpanded)

  return (
    <UserDir
      fs={fs}
      isExpanded={isExpanded}
      isSelected={isSelected}
      level={level}
      metadata={metadata}
      name={name}
      path={path}
      onSelect={onSelect}
    >
      {!nodeChildren || nodeChildren.length === 0 &&
        <Text
          className="text-center text-gray-500"
          size={Text.size.S3}
          text="Empty directory"
        />
      }
      {nodeChildren.length > 0 && nodeChildren.map(n => (
        <React.Fragment key={n.path}>
          {n.type === NodeType.Dir &&
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
              onSelect={onSelect}
            />
          }
          {n.type === NodeType.File &&
            <UserFile
              fs={fs}
              isSelected={n.isSelected}
              key={n.path}
              level={n.level}
              metadata={n.metadata}
              name={n.name}
              path={n.path}
              onSelect={onSelect}
            />
          }
        </React.Fragment>
      ))}
    </UserDir>
  )
})

DirWrapper.displayName = 'DirWrapper'
export default DirWrapper
