import { MouseEvent } from 'react'
import path from 'path'

import { FSNodeType } from './types'
import { FilesystemRoot } from './filesystemRoot'
import { CreateFilesystemComponent, CreateFilesystemIcon, CreateFilesystemPrompt, FilesystemNode } from './filesystemNode'
import sortChildren from './sortChildren'

export type AddItemHandler = (args: { event: MouseEvent, dir: FilesystemDir, type: FSNodeType }) => void

class FilesystemDir extends FilesystemNode {
  readonly name: string
  readonly path: string
  readonly parent: FilesystemDir | FilesystemRoot
  private readonly addItemHandler: AddItemHandler
  children: FilesystemNode[] = []

  constructor(
    {
      name,
      parent,
      onAddItem,
    }: {
      name: string,
      parent: FilesystemDir | FilesystemRoot,
      onAddItem: AddItemHandler,
    }
  ) {
    super()
    this.name = name
    this.parent = parent
    this.addItemHandler = onAddItem

    this.path = path.join(this.parent.path, this.name)
  }

  removeChildNode(node: FilesystemNode) {
    this.children = this.children.filter(c => c !== node)
  }

  serialize(
    createComponent: CreateFilesystemComponent,
    createPrompt: CreateFilesystemPrompt,
    createIcon: CreateFilesystemIcon,
  ) {
    const children = this.children.map(c => c.serialize(createComponent, createPrompt, createIcon))
    return {
      type: 'Dir' as FSNodeType,
      key: this.path,
      title: createComponent(
        {
          name: this.name,
          onAddFileMouseDown: (event: MouseEvent) => {
            this.addItemHandler({ event, dir: this, type: 'File' })
          },
          onAddDirMouseDown: (event: MouseEvent) => {
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
