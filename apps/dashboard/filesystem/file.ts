import Dir from './dir'
import Node, {
  Metadata,
  NodeType,
} from './node'

class File extends Node {
  readonly name: string
  readonly type = NodeType.File

  constructor({
    name,
    parent,
    metadata,
  }: {
    name: string,
    parent?: Dir
    metadata?: Metadata,
  }) {
    super()
    this.name = name
    this.parent = parent
    if (metadata) this.metadata = metadata
  }
}

export default File
