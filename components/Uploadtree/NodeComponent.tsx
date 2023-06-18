// Node is either a log upload or a dir.

export interface Node {
  id: string
  name: string
  children: Node[]
}

export interface Props {
  node: Node
}

function NodeComponent({
  node,
}: Props) {

  if (node.children.length === 0) {
    // Leaft node
    return (
      <div>leaf</div>
    )
  }

  return (
    <div className="flex flex-col">
      {node.name}

      <div className="pl-2 flex flex-col">
        {node.children.map(nodeChild => (
          <NodeComponent key={nodeChild.id} node={nodeChild} />
        ))}
      </div>
    </div>
  )
}

export default NodeComponent