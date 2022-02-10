import {
  MouseEvent,
} from 'react'

import { FSNodeType } from './types'
import {
  CreateFilesystemComponent,
  CreateFilesystemIcon,
  CreateFilesystemPrompt,
  FilesystemNode,
} from './filesystemNode'
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

  serialize(
    createComponent: CreateFilesystemComponent,
    createPrompt: CreateFilesystemPrompt,
    createIcon: CreateFilesystemIcon,
  ) {
    const children = this.children.map(c => c.serialize(createComponent, createPrompt, createIcon))
    return {
      type: 'Root' as FSNodeType,
      key: this.path,
      title: createComponent(
        {
          name: this.name,
          onAddFileMouseDown: (event) => {
            this.addItemHandler({ event, dir: this, type: 'File' })
          },
          onAddDirMouseDown: (event) => {
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
