import { ReactNode } from 'react'

type FSNodeType = 'File' | 'Dir' | 'Prompt' | 'Empty' | 'Root'

interface FSNodeMetadata {
  type: FSNodeType
  path: string
  documentFileID?: string
}

interface SerializedFSNode {
  type: FSNodeType
  key: string
  title: ReactNode
  isLeaf?: boolean
  disabled?: boolean
  children?: SerializedFSNode[]
  icon?: ReactNode
}

interface DirContentEvent {
  dirPath: string
  content: SerializedFSNode[]
}


export type {
  FSNodeType,
  FSNodeMetadata,
  SerializedFSNode,
  DirContentEvent,
}
