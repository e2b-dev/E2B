import { isMatch } from 'matcher'
import path from 'path-browserify'

import { logger } from '../utils/logger'
import Dir from './dir'
import Node, { NodeType } from './node'

const log = logger('filesystem', 'orange', false)

type DirListener = (path: string, children: IterableIterator<Node>) => void
type MetadataListener<T = any> = (path: string, {
  key,
  newVal,
  oldVal,
}: { key: string; newVal?: T; oldVal?: T }) => void

class Filesystem {
  root: Dir
  private lastSelectedPath?: string
  get selectedPath() {
    return this.lastSelectedPath
  }
  private dirListeners = new Map<string, DirListener[]>()
  private metadataListeners = new Map<string, MetadataListener[]>()

  constructor(rootPath: string, initial: Node[]) {
    this.root = new Dir({ name: rootPath })
    initial.forEach(n => {
      n.parent = this.root
      this.root.children.set(n.name, n)
    })
  }

  /**
   * Removes all children and all listeners.
   */
  clear() {
    this.dirListeners.clear()
    this.metadataListeners.clear()

    this.root.children.forEach(c => {
      c.parent = undefined
    })
    this.root.children.clear()
  }

  /**
   * Registers a listener that gets notified when directory's child nodes change (a node is created or deleted).
   * @param path path to a directory
   * @param l listener function
   * @returns unsubscribe method
   */
  addDirListener(path: string, l: DirListener) {
    const ls = this.dirListeners.get(path) || []
    this.dirListeners.set(path, [...ls, l])
    return () => this.removeDirListener(path, l)
  }

  private removeDirListener(path: string, l: DirListener) {
    const ls = this.dirListeners.get(path) || []
    this.dirListeners.set(
      path,
      ls.filter(l1 => l1 !== l),
    )
  }

  private notifyDirListeners(path: string, children: IterableIterator<Node>) {
    const ls = this.dirListeners.get(path) || []
    ls.forEach(l => l(path, children))
  }

  /**
   * Registers a listener that gets notified when node's metadata value changes for the specified key.
   * @param path path to a node in the filesystem
   * @param key metadata key to listen to
   * @param l listener function
   * @returns unsubscribe method
   */
  addMetadataListener<T>(path: string, key: string, l: MetadataListener<T>) {
    const lkey = this.makeMetadataListenerKey(path, key)
    const ls = this.metadataListeners.get(lkey) || []
    this.metadataListeners.set(lkey, [...ls, l])
    return () => this.removeMetadataListener(path, key, l)
  }

  private removeMetadataListener(path: string, key: string, l: MetadataListener) {
    const lkey = this.makeMetadataListenerKey(path, key)
    const ls = this.metadataListeners.get(lkey) || []
    this.metadataListeners.set(
      lkey,
      ls.filter(l1 => l1 !== l),
    )
  }

  private notifyMetadataListeners<T>(path: string, {
    key,
    newVal,
    oldVal,
  }: { key: string; newVal?: T; oldVal?: T }) {
    const lkey = this.makeMetadataListenerKey(path, key)
    const ls = this.metadataListeners.get(lkey)
    ls?.forEach(l => {
      l(path, {
        key,
        oldVal,
        newVal,
      })
    })
  }

  /**
   * Tries to add new nodes to the specified directory.
   * @param dirpath directory where to insert a new node.
   * @param newNodes new nodes to add.
   * @returns an array of node names that couldn't be added because they already exist in the directory.
   */
  add(dirpath: string, newNodes: Node[], ignore?: string[]) {
    const n = this.find(dirpath)
    if (!n) throw new Error(`'${dirpath}': path doesn't exist on the filesystem. Can't create a new node`)
    if (n.type !== NodeType.Dir) throw new Error(`'${dirpath}': isn't a directory. Can't create a new node`)

    const dir = n as Dir

    const existing: string[] = []
    for (const nn of newNodes) {

      // Check if we should filter out a new node.
      if (ignore && ignore.length > 0) {
        if (isMatch(path.join(dir.path, nn.name), ignore)) continue
      }

      if (dir.children.has(nn.name)) {
        existing.push(nn.name)
      } else {
        nn.parent = dir
        dir.children.set(nn.name, nn)
      }
    }

    this.notifyDirListeners(dir.path, dir.children.values())
    return existing
  }

  /**
   * Tries to remove a node on the specified path.
   * @param pathToRemove path to a node that should be removed
   * @returns true if a node was removed, false if path doesn't exist in the filesystem
   */
  remove(pathToRemove: string) {
    const n = this.find(pathToRemove)
    if (!n) return false

    // This shouldn't ever happen.
    if (!n.parent) throw new Error(`Can't delete node. Node on path '${pathToRemove}' has no parent set`)

    // If we are removing a selected node, de-select it first.
    if (n.path === this.lastSelectedPath) {
      this.lastSelectedPath = undefined
    }

    // Parent is always a dir.
    const parent = n.parent as Dir
    const baseName = path.basename(pathToRemove)
    const child = parent.children.get(baseName)
    if (child) {
      child.parent = undefined
      parent.children.delete(baseName)
    }

    this.notifyDirListeners(parent.path, parent.children.values())

    return true
  }

  getChildren(path: string) {
    const n = this.find(path)
    if (!n) throw new Error(`'${path}': no such file or directory`)
    if (n.type !== NodeType.Dir) throw new Error(`'${path}': is not a directory`)
    return (n as Dir).children.values()
  }

  hasChildren(dirpath: string) {
    const n = this.find(dirpath)
    if (!n) throw new Error(`'${dirpath}': no such file or directory`)
    if (n.type !== NodeType.Dir) throw new Error(`'${dirpath}': is not a directory`)
    return (n as Dir).children.size > 0
  }

  setMetadata<T = unknown>(path: string, {
    key,
    value,
  }: { key: string; value: T | undefined }) {
    log('setMetadata', path, {
      key,
      value,
    })
    const n = this.find(path)
    if (!n) throw new Error(`${path}: no such file or directory. Can't set metadata`)

    const oldVal = n.metadata[key]
    n.metadata[key] = value

    this.notifyMetadataListeners<T>(path, {
      key,
      oldVal,
      newVal: value,
    })
  }

  getMetadata<T = unknown>(path: string, key: string): T {
    log('getMetadata', path, key)
    const n = this.find(path)
    if (!n) throw new Error(`${path}: no such file or directory. Can't get metadata`)
    return n.metadata[key]
  }

  setIsDirExpanded(dirpath: string, isExpanded: boolean) {
    const n = this.find(dirpath)
    if (!n) throw new Error(`${dirpath}: no such directory. Can't set isDirExpanded`)
    if (n.type !== NodeType.Dir) throw new Error(`${dirpath}: is not a directory. Can't set isDirExpanded`)

    const dir = n as Dir
    if (!dir.parent) throw new Error(`'${dirpath}: doesn't have parent. Can't set isDirExpanded to dir without parent`)

    if (dir.isExpanded !== isExpanded) {
      dir.isExpanded = isExpanded
      this.notifyDirListeners(dir.parent.path, dir.parent.children.values())
    }
  }

  setIsNodeSelected(path: string, isSelected: boolean) {
    // Deselect previously selected node if there was any.
    if (this.lastSelectedPath && this.lastSelectedPath !== path) {
      this.setIsNodeSelected(this.lastSelectedPath, false)
      this.lastSelectedPath = path
    }

    const n = this.find(path)
    if (!n) throw new Error(`${path}: no such file or directory. Can't set isNodeSelected`)
    if (!n.parent) throw new Error(`'${path}: doesn't have a parent. Can't set isNodeSelected to a node without a parent`)

    if (n.isSelected !== isSelected) {
      n.isSelected = isSelected
      this.lastSelectedPath = path
      this.notifyDirListeners(n.parent.path, n.parent.children.values())
    }
  }

  print(node: Dir = this.root, indent = 0) {
    const indentStr = '  '.repeat(indent)

    console.log(indentStr + node.path, `(${node.name})`)

    node.children.forEach(c => {
      if (c.type === NodeType.Dir) {
        this.print(c as Dir, indent + 1)
      } else {
        console.log(indentStr + '  ' + c.path, `(${c.name})`)
      }
    })
  }

  find(p: string, node: Node = this.root): Node | undefined {
    p = path.normalize(p)
    if (node.path === p) return node

    // No need to go deeper if the searched item on the
    // path `p` is on a lower dir level than we are at now.
    const pathLevel = p.split(path.sep).length - 1
    if (node.level > pathLevel) return

    if (node.type === NodeType.Dir) {
      for (const [, c] of (node as Dir).children) {
        const res = this.find(p, c)
        if (res) return res
      }
    }
  }

  private makeMetadataListenerKey(path: string, key: string) {
    return `${path}-${key}`
  }
}

export default Filesystem
