import useSWRMutation from 'swr/mutation'
import { shallow } from 'zustand/shallow'

import Button from '../Button'
import { Block, State } from 'state/store'
import { getStoreContext } from 'state/StoreProvider'

const selector = (state: State) => ({
  blocks: state.blocks,
})

async function handlePostGenerate(url: string, { arg }: { arg: { blocks: Block[] } }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

export default function DeployButton() {
  const useStore = getStoreContext()

  const {
    blocks,
  } = useStore(selector, shallow)

  const { trigger: generate } = useSWRMutation('/api/generate', handlePostGenerate)

  async function deploy() {
    generate({
      blocks,
    })
  }

  return (
    <Button
      text="Deploy"
      onClick={deploy}
      variant={Button.variant.Full}
    />
  )
}
