import { shallow } from 'zustand/shallow'
import useSWRMutation from 'swr/mutation'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import Hotkeys from 'react-hot-keys'

import { State, Block, methods, Method } from 'state/store'
import { getStoreContext } from 'state/StoreProvider'
import Select from 'components/Select'

import Text from '../typography/Text'
import BlockEditor from './BlockEditor'
import Button from '../Button'
import ConnectionLine from './ConnectionLine'
import AddBlockButton from './AddBlockButton'
import { nanoid } from 'nanoid'

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
  let prompt = ''
  for (const block of arg.blocks) {
    prompt += block.prompt
  }
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ prompt }),

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

  const [focusedBlock, setFocusedBlock] = useState({ index: 0 })

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
    <Hotkeys
      keyName="command+enter,control+enter,shift+command+enter,shift+control+enter"
      onKeyDown={(s) => {
        if (s === 'command+enter' || s === 'control+enter') {
          setFocusedBlock(b => {
            if (blocks.length === 0 || b.index === blocks.length - 1) {
              addBlock({ prompt: '', id: nanoid() })
            }
            return { index: b.index + 1 }
          })
        } else if (s === 'shift+command+enter' || s === 'shift+control+enter') {
          setFocusedBlock(b => ({ index: b.index > 0 ? b.index - 1 : b.index }))
        }
      }}
      filter={() => {
        return true
      }}
      allowRepeat
    >
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
          {blocks.map((b, i) =>
            <Fragment
              key={b.id}
            >
              <ConnectionLine className='h-4' />
              <BlockEditor
                block={b}
                onDelete={() => {
                  removeBlock(i)
                  setTimeout(() => {
                    if (i <= focusedBlock.index) {
                      setFocusedBlock(b => ({ index: b.index - 1 }))
                    } else {
                      setFocusedBlock(b => ({ index: b.index }))
                    }
                  }, 0)
                }}
                onChange={(b) => changeBlock(i, b)}
                index={i}
                focus={focusedBlock}
                onFocus={() => setFocusedBlock({ index: i })}
              />
            </Fragment>
          )}
        </div>
        <ConnectionLine className='h-4' />
        <AddBlockButton addBlock={(block) => {
          addBlock(block)
          setTimeout(() => setFocusedBlock({ index: blocks.length }), 0)
        }} />
        <div className="absolute right-4 top-4">
          <Button
            text="Deploy"
            onClick={deploy}
            variant={Button.variant.Full}
          />
        </div>
      </div>
    </Hotkeys>
  )
}
