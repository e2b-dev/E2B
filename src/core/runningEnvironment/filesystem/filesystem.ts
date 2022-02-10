
/**
* The `Filesystem` class is used for the UI representation of the actual filesystem on the remote running environment.
*
* It's important to understand that changes made to this "client" filesystem like calling
* `setDirsContent()` won't take effect on the remote environment.
*
* Think of this as a mirror of the actual filesystem on the remote environment. To make an
* actual change on the remote environment's filesystem, you need to send a WebSocket message.
*/

import { MouseEvent } from 'react'
import path from 'path'

import Logger from 'src/utils/Logger'

import {
  SerializedFSNode,
  FSNodeType,
} from './types'
import { CreateFilesystemComponent, CreateFilesystemIcon, CreateFilesystemPrompt, FilesystemNode } from './filesystemNode'
import { FilesystemRoot } from './filesystemRoot'
import { FilesystemFile } from './filesystemFile'
import { FilesystemDir } from './filesystemDir'
import { FilesystemPrompt } from './filesystemPrompt'
import { FilesystemEmpty } from './filesystemEmpty'

export type OnNewItemConfirmL = (args: { fullPath: string, name: string, type: FSNodeType }) => void
export type OnDirsChangeL = (args: { dirPaths: string[] }) => void
export type OnFileContent = (args: { path: string, content: string }) => void
export type OnShowPrompt = (args: { dirPath: string }) => void

class Filesystem {
  private logger = new Logger('Filesystem')
  readonly root = new FilesystemRoot({
    onAddItem: ({ event, dir, type }) => this.showPrompt({ event, parent: dir, type }),
  })
  private startingPrintIndent = 0
  private onNewItemConfirmLs: OnNewItemConfirmL[] = []
  private onDirsChangeLs: OnDirsChangeL[] = []
  private onFileContentLs: OnFileContent[] = []
  private onShowPromptLs: OnShowPrompt[] = []

  removeAllListeners() {
    this.onNewItemConfirmLs = []
    this.onDirsChangeLs = []
    this.onFileContentLs = []
    this.onShowPromptLs = []
  }

  addListener(event: 'onShowPrompt', l: OnShowPrompt): void
  addListener(event: 'onFileContent', l: OnFileContent): void
  addListener(event: 'onDirsChange', l: OnDirsChangeL): void
  addListener(event: 'onNewItemConfirm', l: OnNewItemConfirmL): void
  addListener(event: string, l: Function): void {
    switch (event) {
      case 'onNewItemConfirm':
        this.onNewItemConfirmLs.push(l as OnNewItemConfirmL)
        break
      case 'onDirsChange':
        this.onDirsChangeLs.push(l as OnDirsChangeL)
        break
      case 'onFileContent':
        this.onFileContentLs.push(l as OnFileContent)
        break
      case 'onShowPrompt':
        this.onShowPromptLs.push(l as OnShowPrompt)
        break
      default:
        throw new Error(`Unknown event type: ${event}`)
    }
  }

  removeListener(event: 'onShowPrompt', l: OnShowPrompt): void
  removeListener(event: 'onFileContent', l: OnFileContent): void
  removeListener(event: 'onDirsChange', l: OnDirsChangeL): void
  removeListener(event: 'onNewItemConfirm', l: OnNewItemConfirmL): void
  removeListener(event: string, l: Function): void {
    switch (event) {
      case 'onNewItemConfirm':
        this.onNewItemConfirmLs = this.onNewItemConfirmLs.filter(l1 => l1 !== l)
        break
      case 'onDirsChange':
        this.onDirsChangeLs = this.onDirsChangeLs.filter(l1 => l1 !== l)
        break
      case 'onFileContent':
        this.onFileContentLs = this.onFileContentLs.filter(l1 => l1 !== l)
        break
      case 'onShowPrompt':
        this.onShowPromptLs = this.onShowPromptLs.filter(l1 => l1 !== l)
        break
      default:
        throw new Error(`Unknown event type: ${event}`)
    }
  }

  addNodeToDir(dirPath: string, node: { name: string, type: FSNodeType }) {
    this.logger.log('Adding node to dir', { dirPath, node })

    let dirNode = this.find(dirPath)
    if (!dirNode) {
      this.logger.log('Dir not found, will make all', { dirPath })
      dirNode = this.mkAll(dirPath)
    }

    if (!dirNode) throw new Error('dirNode is undefined')
    if (!(
      (dirNode instanceof FilesystemRoot) ||
      (dirNode instanceof FilesystemDir)
    )) throw new Error(`Node at '${dirPath}' is not a directory or a root node`)

    const exists = dirNode.children.some(c => c.name === node.name)
    if (exists) return

    let childNode: FilesystemNode
    if (node.type === 'Dir') {
      childNode = new FilesystemDir({
        name: node.name,
        parent: dirNode,
        onAddItem: ({ event, dir, type }) => this.showPrompt({ event, parent: dir, type }),
      })
    } else {
      childNode = new FilesystemFile({
        name: node.name,
        parent: dirNode,
      })
    }

    if (dirNode.children.length === 1 && (dirNode.children[0] instanceof FilesystemEmpty)) {
      dirNode.children = [childNode]
    } else {
      dirNode.children.push(childNode)
    }

    this.notifyOnDirsChangeLs({ dirPaths: [dirPath] })
  }

  removeNodeFromDir(dirPath: string, node: { name: string }) {
    this.logger.log('Remove node from dir', { dirPath, nodeName: node.name })
    const dirNode = this.find(dirPath)
    if (!dirNode) throw new Error(`No node with path '${dirPath}'`)
    if (!(
      (dirNode instanceof FilesystemRoot) ||
      (dirNode instanceof FilesystemDir)
    )) throw new Error(`Node at '${dirPath}' is not a directory or root node`)

    const startL = dirNode.children.length
    dirNode.children = dirNode.children.filter(c => c.name !== node.name)
    const endL = dirNode.children.length
    if (startL !== endL) {
      if (dirNode.children.length === 0) {
        dirNode.children = [
          new FilesystemEmpty({
            parent: dirNode,
          }),
        ]
      }
      this.notifyOnDirsChangeLs({ dirPaths: [dirPath] })
    } else {
      this.logger.warn('Node not found in dir', { dirPath, nodeName: node.name })
    }
  }

  setFileContent(args: { path: string, content: string }) {
    this.logger.log('Update file content', args)
    // No need to store the actual content in the Filesystem.
    // Just notify listeners that the file content has changed.
    this.onFileContentLs.forEach(l => l(args))
  }

  setDirsContent(
    dirs: {
      dirPath: string,
      content: { name: string, type: FSNodeType }[],
    }[],
  ) {
    this.logger.log('Set dirs content', dirs)
    for (const dir of dirs) {
      let dirNode = this.find(dir.dirPath)
      if (!dirNode) {
        this.logger.log('Dir not found, will make all', { dirPath: dir.dirPath })
        dirNode = this.mkAll(dir.dirPath)
      }

      if (!dirNode) throw new Error('dirNode is undefined')
      if (!(
        (dirNode instanceof FilesystemRoot) ||
        (dirNode instanceof FilesystemDir)
      )) throw new Error(`Node at '${dir.dirPath}' is not a directory or a root node`)

      // If a dir already has a `FilesystemPrompt` as one of it's children, don't remove it.
      // User might be interacting with it.
      const prompt = dirNode.children.find(c => c instanceof FilesystemPrompt)

      if (!dir.content.length) {
        dirNode.children = [
          new FilesystemEmpty({
            parent: dirNode,
          }),
        ]
      } else {
        const children: FilesystemNode[] = []
        for (const c of dir.content) {
          let childNode: FilesystemNode

          if (c.type === 'Dir') {
            childNode = new FilesystemDir({
              name: c.name,
              parent: dirNode,
              onAddItem: ({ event, dir, type }) => this.showPrompt({ event, parent: dir, type }),
            })
          } else {
            childNode = new FilesystemFile({
              name: c.name,
              parent: dirNode,
            })
          }
          children.push(childNode)
        }
        dirNode.children = children
      }

      // Put back the prompt if it was there before.
      if (prompt) dirNode.children.push(prompt)
    }
    this.notifyOnDirsChangeLs({ dirPaths: dirs.map(d => d.dirPath) })
  }

  /**
   * Shows an input prompt for a new dir/file in the given parent node.
   */
  private showPrompt(args: { event: MouseEvent, parent: FilesystemRoot | FilesystemDir, type: FSNodeType }) {
    const { event, parent, type } = args
    this.logger.log('Show prompt', { parent, type })

    // Ignore if the prompt is already shown.
    if (parent.children.some(c => c instanceof FilesystemPrompt)) {
      return
    }

    // Prevents from firing a blur even on the `FilesystemNamePrompt` input.
    event.preventDefault()

    // This function gets called when a user confirms the prompt input.
    const onPromptConfirm = (prompt: FilesystemPrompt, name: string) => {
      this.logger.log('Prompt confirm', { prompt, name })
      if (!name) return

      const dirPath = prompt.parent.path

      // Since the prompt node is the child of the selected directory where
      // the new item should be created, the path of a new item is the concatenation
      // of the path of the selected directory and the name of the new item.
      const newItemPath = path.join(prompt.parent.path, name)

      // Remove the prompt node from the tree.
      this.removeFromParent(prompt)
      // Because we removed the prompt node from the tree, we
      // need to notify listeners that the tree has changed.
      this.notifyOnDirsChangeLs({ dirPaths: [dirPath] })

      // Also notify all listeners that user has confirmed the new item name.
      this.notifyOnNewItemConfirmLs({ fullPath: newItemPath, name, type })
    }

    // Hide the prompt when user unfocuses the input.
    const onPromptBlur = (prompt: FilesystemPrompt) => {
      this.logger.log('Prompt blur', { prompt })

      const dirPath = prompt.parent.path

      // Remove the prompt node from the tree.
      this.removeFromParent(prompt)

      // Because we removed the prompt node from the tree, we need to
      // to notify listeners that the tree has changed.
      this.notifyOnDirsChangeLs({ dirPaths: [dirPath] })
    }

    // Create the prompt node with the currently selected node as its parent.
    const prompt = new FilesystemPrompt({
      parent,
      //parent: this.selected,
      forNode: type,
      onConfirm: onPromptConfirm.bind(this),
      onBlur: onPromptBlur.bind(this),
    })
    // Add new prompt as a child of the currently selected node.
    //this.selected.children.push(prompt)
    parent.children.push(prompt)

    // Notify listeners that the dir containing the prompt has changed.
    // The listiner will probably serialize the tree and update the UI.
    this.notifyOnDirsChangeLs({ dirPaths: [prompt.parent.path] })

    // Notify listeners that the prompt node has been shown.
    // The listener will probably expand the dir node in which the prompt is shown.
    this.notifyOnShowPromptLs({ dirPath: prompt.parent.path })
  }

  serialize(
    createComponent: CreateFilesystemComponent,
    createPrompt: CreateFilesystemPrompt,
    createIcon: CreateFilesystemIcon,
  ): SerializedFSNode[] {
    this.logger.log('Serialize')
    return [this.root.serialize(createComponent, createPrompt, createIcon)]
  }

  print(node: FilesystemDir | FilesystemRoot = this.root, indent = this.startingPrintIndent) {
    const indentStr = '  '.repeat(indent)

    console.log(indentStr + node.path, `(${node.name})`)

    for (const c of node.children) {
      if (c instanceof FilesystemDir) {
        this.print(c as FilesystemDir, indent + 1)
      } else {
        console.log(indentStr + '  ' + c.path, `(${c.name})`)
      }
    }
  }

  private find(p: string, node: FilesystemNode = this.root): FilesystemNode | undefined {
    this.logger.log('Find (recursion)', { currentPath: node.path, targetPath: p })
    p = path.normalize(p)
    if (node.path === p) return node

    // No need to go deeper if the searched item on the
    // path `p` is on a lower dir level than we are at now.
    const pathLevel = p.split(path.sep).length - 1
    if (node.level > pathLevel) return

    if (
      (node instanceof FilesystemRoot) ||
      (node instanceof FilesystemDir)
    ) {
      for (const c of (node as FilesystemDir).children) {
        const res = this.find(p, c)
        if (res) return res
      }
    }
  }

  /**
   * Creates a directory at the given path.
   * @returns The created directory.
   */
  private mkDir(args: { parentPath: string, name: string }) {
    this.logger.log('Make dir', args)

    const parent = this.find(args.parentPath)
    if (!parent) throw new Error(`Parent dir '${args.parentPath}' not found`)
    if (!(
      (parent instanceof FilesystemRoot) ||
      (parent instanceof FilesystemDir)
    )) {
      throw new Error('Parent is not a dir or root')
    }

    const dir = new FilesystemDir({
      parent,
      name: args.name,
      onAddItem: ({ event, dir, type }) => this.showPrompt({ event, parent: dir, type }),
    })
    parent.children.push(dir)
    return dir
  }

  /**
   * Creates a directory at the given path and all the directories along the way if necessary.
   * @returns The last created directory.
   */
  private mkAll(p: string) {
    this.logger.log('Make all', p)

    const parts = p.split(path.sep)

    let currPath = '/'
    let lastDir: FilesystemDir | undefined

    for (const part of parts) {
      currPath = path.join(currPath, part)
      if (!this.find(currPath)) {
        const parentPath = path.dirname(currPath)
        lastDir = this.mkDir({ parentPath, name: part })
      }
    }

    return lastDir
  }

  private removeFromParent(node: FilesystemNode) {
    const { parent } = node
    if (
      (parent instanceof FilesystemRoot) ||
      (parent instanceof FilesystemDir)
    ) {
      parent.children = parent.children.filter(c => c !== node)
    }
    node.parent = undefined
  }

  private notifyOnShowPromptLs(args: { dirPath: string }) {
    this.logger.log('Notify on show prompt', args)
    this.onShowPromptLs.forEach(l => l(args))
  }

  private notifyOnNewItemConfirmLs(args: { fullPath: string, name: string, type: FSNodeType }) {
    this.logger.log('Notify on new item confirm', args)
    this.onNewItemConfirmLs.forEach(l => l(args))
  }

  private notifyOnDirsChangeLs(args: { dirPaths: string[] }) {
    this.logger.log('Notify on dirs change', args)
    this.onDirsChangeLs.forEach(l => l(args))
  }
}

export {
  Filesystem,
}