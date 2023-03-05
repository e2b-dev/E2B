import { shallow } from 'zustand/shallow'
import { api_deployments } from '@prisma/client'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'

import { createStore, State } from 'state/store'

import Button from './Button'
import Text from './typography/Text'

const selector = (state: State) => ({
  blocks: state.blocks,
  addBlock: state.addBlock,
  removeBlock: state.removeBlock,
  changeBlock: state.changeBlock,
})

const useStore = createStore([
  {
    code: 'cd',
    type: 'type',
  },
  {
    code: 'cd',
    type: 'type',
  },
  {
    code: 'cd',
    type: 'type',
  },
  {
    code: 'cd',
    type: 'type',
  },
])

export interface Props {
  deployment: api_deployments
}

// function useDeployment(deployment: api_deployments) {
//   const [latest, setLatest] = useState<api_deployments>(deployment)
//   const client = useSupabaseClient()

//   useEffect(function subscribe() {
//     const sub = client.channel('any')
//       .on('postgres_changes',
//         {
//           event: 'UPDATE',
//           schema: 'public',
//           table: 'api_deployments',
//           filter: `id=eq.${deployment.id}`,
//         }, payload => {
//           console.log('Change received!', payload)
//           setLatest(l => ({ ...l, data: payload.new.data }))
//         })
//       .subscribe()

//     return () => {
//       sub.unsubscribe()
//     }
//   }, [deployment, client])

//   return latest
// }

export default function DeploymentEditor({ deployment }: Props) {
  const {
    addBlock,
    blocks,
    changeBlock,
    removeBlock,
  } = useStore(selector, shallow)

  // const syncedDeployment = useDeployment(deployment)
  // const dbBlocks = blocks || syncedDeployment.data as unknown as State['blocks']

  return (
    <div className="
      flex
      flex-1
      p-4
      space-y-4
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
      <div className="
        flex
        flex-col
        space-y-4
        max-w-[800px]
        w-full
        ">
        {
          blocks.map((b, i) =>
            <div
              key={i}
              className="
              flex
              flex-1
              rounded
              bg-white
              border
              border-slate-200
              p-4
              min-h-[100px]
              "
            >
              <div className="">{b.type}</div>
              <div>{b.code}</div>
              <div />
            </div>
          )
        }
      </div>
      <div className="flex">
        <Button
          text="Add block"
          variant={Button.variant.Outline}
          onClick={() => addBlock({
            code: 'lore',
            type: 'as',
          })}
        />
      </div>
    </div>
  )
}
