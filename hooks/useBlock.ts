import { useCallback } from 'react'
import { Route, BlockType, Block } from 'state/store'
import { useStateStore } from 'state/StoreProvider'

function useBlock(blockType: BlockType, position: number, route?: Route): [Block | undefined, (prompt: string) => void] {
  const [selectors] = useStateStore()

  const changeBlock = selectors.use.changeBlock()

  let count = 0
  const blockIdx = route?.blocks.findIndex(r => {
    if (r.type === blockType) {
      count++
      return count = position
    }
  })

  const block = blockIdx !== undefined &&
    blockIdx !== -1 &&
    route?.blocks.length !== undefined &&
    route?.blocks.length >= blockIdx
    ? route?.blocks[blockIdx]
    : undefined

  const setBlock = useCallback((prompt: string) => {
    if (route?.id && blockIdx !== undefined && blockIdx !== -1) {
      changeBlock(route.id, blockIdx, { prompt })
    }
  }, [blockIdx, route?.id])

  return [block, setBlock]
}

export default useBlock
