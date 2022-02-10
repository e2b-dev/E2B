import path from 'path'
import { ReactNode, MouseEvent } from 'react'

import { FSNodeType, SerializedFSNode } from './types'

export type CreateFilesystemPrompt = (args: {
  onConfirm: (name: string) => void,
  onBlur: () => void,
}) => ReactNode

export type CreateFilesystemComponent = (args: {
  name: string,
  onAddFileMouseDown: (event: MouseEvent) => void,
  onAddDirMouseDown: (event: MouseEvent) => void,
}) => ReactNode

export type CreateFilesystemIcon = (args: {
  type: FSNodeType,
}) => ReactNode

abstract class FilesystemNode {
  abstract name: string
  abstract path: string
  abstract parent?: FilesystemNode

  get level(): number {
    const n = path.normalize(this.path)
    return n.split(path.sep).length - 1
  }

  abstract serialize(
    createComponent: CreateFilesystemComponent,
    createPrompt: CreateFilesystemPrompt,
    createIcon: CreateFilesystemIcon,
  ): SerializedFSNode
}

export {
  FilesystemNode,
}
