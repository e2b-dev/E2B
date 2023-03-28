import { useCallback, useMemo } from 'react'
import { Route, BlockType, Block } from 'state/store'
import { useStateStore } from 'state/StoreProvider'

function useBlock(blockType: BlockType, position: number, route?: Route): [Block | undefined, (prompt: string) => void] {
  const [selectors] = useStateStore()

  const changeBlock = selectors.use.changeBlock()

  const blockIdx = useMemo(() => {
    let count = 0
    return route?.blocks.findIndex((r, i) => {
      console.log(blockType, position, count, r.type)
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

  const setBlock = useCallback((prompt: string) => {
    console.log('SET BLOCK', prompt)
    if (route?.id && blockIdx !== undefined && blockIdx !== -1) {
      changeBlock(route.id, blockIdx, { prompt })
    }
  }, [blockIdx, route?.id, changeBlock])

  return [block, setBlock]
}

export default useBlock
