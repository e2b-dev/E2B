import path from 'path'

import { FSNodeType } from './types'
import { FilesystemNode } from './filesystemNode'
import { FilesystemRoot } from './filesystemRoot'
import { FilesystemDir } from './filesystemDir'

class FilesystemEmpty extends FilesystemNode {
  readonly name = 'empty-node'
  readonly path: string
  readonly parent: FilesystemDir | FilesystemRoot

  constructor({
    parent,
  }: {
    parent: FilesystemDir | FilesystemRoot
  }) {
    super()
    this.parent = parent
    this.path = path.join(this.parent.path, this.name)
  }

  serialize() {
    return {
      type: 'Empty' as FSNodeType,
      key: this.path,
      title: 'Empty Directory',
      isLeaf: true,
      disabled: true,
    }
  }
}

export {
  FilesystemEmpty,
}
