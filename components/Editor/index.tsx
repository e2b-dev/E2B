import { shallow } from 'zustand/shallow'
import useSWRMutation from 'swr/mutation'

import { State, Block } from 'state/store'
import { getStoreContext } from 'state/StoreProvider'

import Text from '../typography/Text'
import HeadBlock from './HeadBlock'
import BodyBlock from './BodyBlock'
import Button from '../Button'
import ConnectionLine from './ConnectionLine'
import { Fragment } from 'react'

const selector = (state: State) => ({
  blocks: state.blocks,
  addBlock: state.addBlock,
  removeBlock: state.deleteBlock,
  changeBlock: state.changeBlock,
})

export interface Props { }

async function handlePostGenerate(url: string, { arg }: { arg: { blocks: Block[] } }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

export default function Editor({ }: Props) {
  const useStore = getStoreContext()

  const {
    addBlock,
    blocks,
    changeBlock,
    removeBlock,
  } = useStore(selector, shallow)

  const { trigger: generate } = useSWRMutation('/api/generate', handlePostGenerate)

  async function deploy() {
    generate({
      blocks,
    })
  }

  return (
    <div className="
      flex
      flex-1
      p-8
      flex-col
      items-center
      overflow-auto
      relative
    ">
      <div className="flex">
        <Text
          text="Request"
          className='font-bold'
        />
      </div>
      <ConnectionLine className='h-4' />
      <div className="
        flex
        flex-col
        items-center
        transition-all
        ">
        {
          blocks.map((b, i, a) =>
            <Fragment
              key={i.toString() + ' ' + a.length}
            >
              <BodyBlock
                block={b}
                onDelete={() => removeBlock(i)}
                onChange={(b) => changeBlock(i, b)}
              />
              <ConnectionLine className='h-4' />
            </Fragment>
          )
        }
      </div>
      <HeadBlock onConfirm={addBlock} />
      <div className="absolute right-4 top-4">
        <Button
          text="Deploy"
          onClick={deploy}
          variant={Button.variant.Full}
        />
      </div>
    </div>
  )
}
