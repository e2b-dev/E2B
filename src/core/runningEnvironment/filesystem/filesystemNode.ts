import path from 'path'

import { SerializedFSNode } from './types'

abstract class FilesystemNode {
  abstract name: string
  abstract path: string
  abstract parent?: FilesystemNode

  get level(): number {
    const n = path.normalize(this.path)
    return n.split(path.sep).length - 1
  }

  abstract serialize(): SerializedFSNode
}

export {
  FilesystemNode,
}
