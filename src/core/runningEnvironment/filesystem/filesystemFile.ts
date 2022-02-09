import path from 'path'

import { FSNodeType } from './types'
import { FilesystemRoot } from './filesystemRoot'
import { FilesystemDir } from './filesystemDir'
import { FilesystemNode } from './filesystemNode'

class FilesystemFile extends FilesystemNode {
  readonly name: string
  readonly path: string
  readonly parent: FilesystemDir | FilesystemRoot
  isShared: boolean
  documentFileID?: string

  constructor({
    name,
    parent,
    isShared,
  }: {
    name: string,
    parent: FilesystemDir | FilesystemRoot
    isShared: boolean,
  }) {
    super()
    this.name = name
    this.isShared = isShared
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
