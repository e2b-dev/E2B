import path from 'path-browserify'

import Dir from './dir'

export enum NodeType {
  File = 'File',
  Dir = 'Dir',
}

export interface Metadata {
  [name: string]: any
}

abstract class Node {
  abstract name: string
  abstract type: NodeType
  metadata: Metadata = {}

  isSelected = false

  private _path?: string
  get path(): string {
    if (!this._path) {
      this._path = path.join(this.parent?.path || '/', this.name)
    }
    return this._path
  }

  // Root dir doesn't have a parent.
  private _parent?: Dir
  get parent(): Dir | undefined {
    return this._parent
  }
  set parent(par: Dir | undefined) {
    if (par) {
      this._parent = par
      this._path = path.join(par.path || '/', this.name)
    }
  }

  /**
   * Level indicates the depth of a node in the filesystem.
   * A dir in the root directory has a level 0, a file in this
   * dir has a level 1, etc.
   */
  get level(): number {
    if (this.parent) return this.parent.level + 1
    // This makes sure that a files in the root have level 0. The root itself has level -1.
    else return -1
  }
}

export default Node
