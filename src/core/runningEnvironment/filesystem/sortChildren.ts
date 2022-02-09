import { SerializedFSNode } from './types'

function sortChildren(nodes: SerializedFSNode[]) {
  nodes.sort((a, b) => {
    if (a.type === 'Prompt') return -2 // Put the prompt node first.

    // If one is a directory and the other a file, put the directory first.
    if (a.type !== b.type) {
      if (a.type === 'Dir') return -1 // `a` will be before `b`.
      if (b.type === 'Dir') return 1 // `b` will be before `a`.
      return 0
    }
    // If both elements are of the same type, sorty by keys (keys are fs paths).
    return a.key.localeCompare(b.key)
  })
  return nodes
}

export default sortChildren