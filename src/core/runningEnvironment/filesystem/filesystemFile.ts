import path from 'path'

import { FSNodeType } from './types'
import { FilesystemRoot } from './filesystemRoot'
import { FilesystemDir } from './filesystemDir'
import { FilesystemNode } from './filesystemNode'

class FilesystemFile extends FilesystemNode {
  readonly name: string
  readonly path: string
  readonly parent: FilesystemDir | FilesystemRoot
  documentFileID?: string

  constructor({
    name,
    parent,
  }: {
    name: string,
    parent: FilesystemDir | FilesystemRoot
  }) {
    super()
    this.name = name
    this.parent = parent

    this.path = path.join(this.parent.path, this.name)
  }

  serialize() {
    return {
      type: 'File' as FSNodeType,
      key: this.path,
      title: this.name,
      isLeaf: true,
    }
  }
}

export {
  FilesystemFile,
}
