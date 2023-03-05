import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { apiDeploymentsTable } from '@/db/tables'
import { Database } from '@/db/supabase'

export interface Block {
  type: string
  code: string
}

export interface State {
  blocks: Block[]
  changeBlock: (index: number, block: Partial<Block>) => void
  removeBlock: (index: number) => void
  addBlock: (block: Block) => void
}

export function createStore(blocks: Block[], id: string, client: SupabaseClient<Database>) {
  const immerStore = immer<State>((set) => ({
    blocks,
    changeBlock: (index, block) =>
      set(state => {
        state.blocks[index] = { ...state.blocks[index], ...block }
      }),
    removeBlock: (index) =>
      set(state => {
        state.blocks.splice(index, 1)
      }),
    addBlock: (block) =>
      set(state => {
        state.blocks.push(block)
      }),
  }))

  client.from('')

  const persistent = persist(immerStore, {
    name: 'supabase-storage',
    partialize: (state) => state.blocks,
    storage: {
      getItem: async (name) => {
        const res = await client.from(apiDeploymentsTable).select('data').eq('id', id)
        if (res.error) {
          throw res.error
        }
        return res.data as Pick<State, 'blocks'>
      },
      removeItem: () => {

      },
      setItem: (name, value) => {


        value.state

      },
    }
  })

  const useStore = create<State, [["zustand/persist", unknown], ["zustand/immer", never]]>(persistent)
  return useStore
}
