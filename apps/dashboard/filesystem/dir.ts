import Node, {
  Metadata,
  NodeType,
} from './node'

class Dir extends Node {
  readonly name: string
  readonly type = NodeType.Dir
  children = new Map<string, Node>()
  isExpanded = false

  constructor(
    {
      name,
      parent,
      metadata,
      isExpanded = false,
    }: {
      name: string,
      parent?: Dir, // Root dir doesn't have a parent.
      metadata?: Metadata,
      isExpanded?: boolean,
    }
  ) {
    super()
    this.name = name
    this.parent = parent
    if (metadata) this.metadata = metadata
    this.isExpanded = isExpanded
  }
}

export default Dir
