import path from 'path'
import React from 'react'
import {
  FileOutlined,
  FolderOutlined,
} from '@ant-design/icons'

import { FilesystemNamePrompt } from 'src/components/Filesystem'

import { FSNodeType } from './types'
import { FilesystemNode } from './filesystemNode'

/**
 * `FilesystemPrompt` doesn't represent any type of an actual physical filesystem item.
 * It's an auxiliary class that is used to represent an input prompt where user types a
 * name of a new filesystem item.
 */
class FilesystemPrompt extends FilesystemNode {
  readonly name = 'name-prompt'
  readonly parent: FilesystemNode
  readonly path: string
  forNode: FSNodeType // For what new future node we are displaying prompt.

  onConfirm?: (prompt: FilesystemPrompt, name: string) => void
  onBlur?: (prompt: FilesystemPrompt) => void

  constructor(
    {
      parent,
      forNode,
      onConfirm,
      onBlur,
    }: {
      parent: FilesystemNode
      forNode: FSNodeType
      onConfirm?: (prompt: FilesystemPrompt, name: string) => void,
      onBlur?: (prompt: FilesystemPrompt) => void,
    }
  ) {
    super()
    this.parent = parent
    this.forNode = forNode
    this.path = path.join(parent.path, this.name)

    this.onConfirm = onConfirm
    this.onBlur = onBlur
  }

  serialize() {
    return {
      type: 'Prompt' as FSNodeType,
      key: this.path,
      title: React.createElement(FilesystemNamePrompt, {
        onConfirm: name => this.onConfirm?.(this, name),
        onBlur: () => this.onBlur?.(this),
      }),
      isLeaf: true,
      selectable: false,
      icon: this.forNode === 'File' ? React.createElement(FileOutlined) : React.createElement(FolderOutlined),
    }
  }
}

export {
  FilesystemPrompt,
}
