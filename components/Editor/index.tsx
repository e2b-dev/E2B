import { shallow } from 'zustand/shallow'
import useSWRMutation from 'swr/mutation'
import { Fragment, useState } from 'react'
import Hotkeys from 'react-hot-keys'
import { projects } from '@prisma/client'

import { State, Block, methods, Method } from 'src/state/store'
import { getStoreContext } from 'src/state/StoreProvider'
import Select from 'src/components/Select'
import { nanoid } from 'nanoid'
import Button from 'components/Button'
import Text from 'components/Text'
import { useLatestDeployment } from 'hooks/useLatestDeployment'

import BlockEditor from './BlockEditor'
import ConnectionLine from './ConnectionLine'
import AddBlockButton from './AddBlockButton'

const selector = (state: State) => ({
  blocks: state.blocks,
  method: state.method,
  addBlock: state.addBlock,
  removeBlock: state.deleteBlock,
  changeBlock: state.changeBlock,
  changeMethod: state.changeMethod,
})

export interface Log {

}

export interface Props {
  project: projects
}

async function handlePostGenerate(url: string, { arg }: {
  arg: {
    blocks: Block[],
    method: Method,
  },
}) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      projectId: '460355b3',
      blocks: arg.blocks.map(b => b.prompt),
      method: arg.method.toLowerCase(),
    }),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

export default function Editor({ project }: Props) {
  const useStore = getStoreContext()

  const deployment = useLatestDeployment(project)
  const logs = deployment?.logs as Log[] | undefined

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
        <ConnectionLine className='min-h-[16px]' />
        <AddBlockButton addBlock={(block) => {
          addBlock(block)
          setTimeout(() => setFocusedBlock({ index: blocks.length }), 0)
        }} />
        <div className="fixed right-3 top-12">
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
