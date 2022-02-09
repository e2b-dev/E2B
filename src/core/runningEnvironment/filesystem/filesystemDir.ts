import React, {
  MouseEvent,
} from 'react'
import path from 'path'

import { FSNodeType } from './types'
import { FilesystemRoot } from './filesystemRoot'
import { FilesystemNode } from './filesystemNode'
import sortChildren from './sortChildren'

export type AddItemHandler = (args: { event: MouseEvent, dir: FilesystemDir, type: FSNodeType }) => void

class FilesystemDir extends FilesystemNode {
  readonly name: string
  readonly path: string
  readonly parent: FilesystemDir | FilesystemRoot
  private readonly addItemHandler: AddItemHandler
  children: FilesystemNode[] = []
  isShared: boolean

  constructor(
    {
      name,
      parent,
      isShared = false,
      onAddItem,
    }: {
      name: string,
      parent: FilesystemDir | FilesystemRoot,
      isShared: boolean,
      onAddItem: AddItemHandler,
    }
  ) {
    super()
    this.name = name
    this.parent = parent
    this.isShared = isShared
    this.addItemHandler = onAddItem

    this.path = path.join(this.parent.path, this.name)
  }

  removeChildNode(node: FilesystemNode) {
    this.children = this.children.filter(c => c !== node)
  }

  serialize() {
    const children = this.children.map(c => c.serialize())
    return {
      type: 'Dir' as FSNodeType,
      key: this.path,
      title: React.createElement(
        FSDirComponent,
        {
          name: this.name,
          onAddFileMouseDown: event => {
            this.addItemHandler({ event, dir: this, type: 'File' })
          },
          onAddDirMouseDown: event => {
            this.addItemHandler({ event, dir: this, type: 'Dir' })
          },
        },
      ),
      children: sortChildren(children),
    }
  }
}

export {
  FilesystemDir,
}
