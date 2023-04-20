import { useCallback, useMemo } from 'react'

import { Route, BlockType, TemplateBlock } from 'state/store'
import { useStateStore } from 'state/StoreProvider'

/**
 * 
 * For example, if there are two block for type `RequestBody` and we call `useBlock('RequestBody`, 2, route)`,
 * the hook will return the value and change handler for the second `RequestBody` block from the array of all blocks in the `route`.
 * 
 * @param blockType type of block to filter
 * @param position which block from all the blocks with type `blockType` should this hook use. 
 * The position starts from "1". 
 * @param route 
 * @returns 
 */
function useBlock(blockType: BlockType, position: number, route?: Route): [TemplateBlock | undefined, (prompt: string) => void] {
  const [selectors] = useStateStore()

  const changeBlock = selectors.use.changeBlock()

  const blockIdx = useMemo(() => {
    let count = 0
    return route?.blocks.findIndex((r, i) => {
      if (r.type === blockType) {
        count++
        return count === position
      }
      return false
    })
  }, [route, position, blockType])

  const block = blockIdx !== undefined &&
    blockIdx !== -1 &&
    route?.blocks.length !== undefined &&
    route?.blocks.length >= blockIdx
    ? route?.blocks[blockIdx]
    : undefined

  const setBlock = useCallback((content: string) => {
    if (route?.id && blockIdx !== undefined && blockIdx !== -1) {
      changeBlock(route.id, blockIdx, { content })
    }
  }, [blockIdx, route?.id, changeBlock])

  return [block, setBlock]
}

export default useBlock
