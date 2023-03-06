import { shallow } from 'zustand/shallow'
import useSWRMutation from 'swr/mutation'
import { Fragment } from 'react'

import { State, Block, methods, Method } from 'state/store'
import { getStoreContext } from 'state/StoreProvider'
import Select from 'components/Select'

import Text from '../typography/Text'
import BlockEditor from './BlockEditor'
import Button from '../Button'
import ConnectionLine from './ConnectionLine'
import AddBlockButton from './AddBlockButton'
import { toast } from 'sonner'

const selector = (state: State) => ({
  blocks: state.blocks,
  method: state.method,
  addBlock: state.addBlock,
  removeBlock: state.deleteBlock,
  changeBlock: state.changeBlock,
  changeMethod: state.changeMethod,
})

export interface Props { }

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    blocks: Block[],
    method: Method,
  }
}) {
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
    method,
    changeBlock,
    removeBlock,
    changeMethod,
  } = useStore(selector, shallow)

  const { trigger: generate } = useSWRMutation('/api/generate', handlePostGenerate)

  async function deploy() {
    const response = await generate({
      blocks,
      method,
    })
    toast(response)
    console.log(response)
  }

  return (
    <div className="
      flex
      flex-1
      p-8
      flex-col
      items-center
      overflow-auto
      scroller
      relative
    ">
      <div className="flex items-center space-x-2">
        <Text
          text="Incoming"
          className='font-bold'
        />
        <Select
          direction="left"
          selectedValue={{ key: method, title: method }}
          values={methods.map(m => ({ key: m, title: m }))}
          onChange={m => changeMethod(m.title as Method)}
        />
        <Text
          text="Request"
          className='font-bold'
        />
      </div>
      <div className="
        flex
        flex-col
        items-center
        transition-all
        ">
        {blocks.map((b, i, a) =>
          <Fragment
            key={b.id}
          >
            <ConnectionLine className='h-4' />
            <BlockEditor
              block={b}
              onDelete={() => removeBlock(i)}
              onChange={(b) => changeBlock(i, b)}
              isLast={i === a.length - 1}
            />
          </Fragment>
        )}
      </div>
      <ConnectionLine className='h-4' />
      <AddBlockButton addBlock={addBlock} />
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
