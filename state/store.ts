import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { api_deployments } from '@prisma/client'

import { apiDeploymentsTable } from 'db/tables'
import { Database } from 'db/supabase'

export interface Tool {
  name: string
}

export interface Block {
  tools?: Tool[]
  prompt: string
}

export interface State {
  blocks: Block[]
  changeBlock: (index: number, block: Partial<Block>) => void
  deleteBlock: (index: number) => void
  addBlock: (block: Block) => void
}

export function createStore(deployment?: api_deployments, client?: SupabaseClient<Database>) {
  const immerStore = immer<State>((set) => ({
    blocks: (deployment?.data as any)?.state?.blocks || [],
    changeBlock: (index, block) =>
      set(state => {
        state.blocks[index] = { ...state.blocks[index], ...block }
      }),
    deleteBlock: (index) =>
      set(state => {
        state.blocks.splice(index, 1)
      }),
    addBlock: (block) =>
      set(state => {
        state.blocks.push(block)
      }),
  }))

  const persistent = persist(immerStore, {
    name: 'supabase-storage',
    partialize: (state) => state,
    storage: client && deployment ? createJSONStorage(() => ({
      getItem: async (name) => {
        const res = await client.from(apiDeploymentsTable).select('data').eq('id', deployment.id).single()
        if (res.error) {
          throw res.error
        }
        return JSON.stringify(res.data.data)
      },
      removeItem: async () => {
        const res = await client.from(apiDeploymentsTable).update({ data: {} }).eq('id', deployment.id).single()
        if (res.error) {
          throw res.error
        }
      },
      setItem: async (name, value) => {
        const res = await client.from(apiDeploymentsTable).update({ data: JSON.parse(value) }).eq('id', deployment.id).single()
        if (res.error) {
          throw res.error
        }
      },
    })) : undefined,
  })

  const useStore = create<State, [["zustand/persist", unknown], ["zustand/immer", never]]>(persistent)
  return useStore
}
