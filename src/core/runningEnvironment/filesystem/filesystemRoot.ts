import React, {
  MouseEvent,
} from 'react'

import { FilesystemDir as FSDirComponent } from 'src/components/Filesystem'

import { FSNodeType } from './types'
import { FilesystemNode } from './filesystemNode'
import sortChildren from './sortChildren'

export type AddItemHandler = (args: { event: MouseEvent, dir: FilesystemRoot, type: FSNodeType }) => void

class FilesystemRoot extends FilesystemNode {
  readonly name = '/'
  readonly path = '/'
  readonly parent = undefined
  private readonly addItemHandler: AddItemHandler
  children: FilesystemNode[] = []

  constructor({
    onAddItem,
  }: {
    onAddItem: AddItemHandler,
  }) {
    super()
    this.addItemHandler = onAddItem
  }

  serialize() {
    const children = this.children.map(c => c.serialize())
    return {
      type: 'Root' as FSNodeType,
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
  FilesystemRoot,
}
