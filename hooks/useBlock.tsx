import { useCallback } from 'react'
import { Route, BlockType, Block } from 'state/store'
import { useStateStore } from 'state/StoreProvider'

function useBlock(blockType: BlockType, route?: Route): [Block | undefined, (prompt: string) => void] {
  const store = useStateStore()

  const changeBlock = store.use.changeBlock()

  const blockIdx = route?.blocks.findIndex(r => r.type === blockType)
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
