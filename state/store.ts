import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { api_deployments } from '@prisma/client'

import { apiDeploymentsTable } from 'db/tables'
import { Database } from 'db/supabase'
import { nanoid } from 'nanoid'

export interface Tool {
  name: string
}

export interface Block {
  tools?: Tool[]
  id: string
  prompt: string
}

export enum Method {
  POST = 'post',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
}

export const methods = Object.keys(Method).filter((item) => {
  return isNaN(Number(item))
})

export interface State {
  blocks: Block[]
  method: Method
  changeBlock: (index: number, block: Partial<Block>) => void
  deleteBlock: (index: number) => void
  addBlock: (block: Block) => void
  changeMethod: (method: Method) => void
}

const defaultBlock: Block = { prompt: '', id: nanoid() }
const defaultState: Pick<State, 'blocks' | 'method'> = {
  blocks: [defaultBlock],
  method: Method.POST,
}

export function createStore(deployment?: api_deployments, client?: SupabaseClient<Database>) {
  const state = (deployment?.data as any).state as Pick<State, 'blocks' | 'method'> || defaultState

  if (state.blocks.length === 0) {
    state.blocks.push(defaultBlock)
  }

  state.blocks.forEach(s => {
    if (!s.id) {
      s.id = nanoid()
    }
  })

  const immerStore = immer<State>((set) => ({
    ...state,
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
    changeMethod: (method) =>
      set(state => {
        state.method = method
      }),
  }))

  const persistent = persist(immerStore, {
    name: 'supabase-storage',
    partialize: (state) => state,
    storage: client && deployment ? {
      getItem: async (name) => {
        // We retrieve the data on the server
        return null
      },
      removeItem: async () => {
        const res = await client.from(apiDeploymentsTable).update({ data: {} }).eq('id', deployment.id).single()
        if (res.error) {
          throw res.error
        }
      },
      setItem: async (name, value) => {
        const res = await client.from(apiDeploymentsTable).update({ data: value as any }).eq('id', deployment.id).single()
        if (res.error) {
          throw res.error
        }
      },
    } : undefined,
  })

  const useStore = create<State, [['zustand/persist', unknown], ['zustand/immer', never]]>(persistent)
  return useStore
}
