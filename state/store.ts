import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'
import { projects, Prisma } from '@prisma/client'

import { Database } from 'db/supabase'
import { projectsTable } from 'db/tables'

export type BlockType =
  // Raw text
  'Basic' |
  // Code that looks like TypeScript interface definition without the outer parenthesses.
  'RequestBody' |
  // ProseMirror HTML
  'StructuredProse'

export interface Block {
  id: string
  type: BlockType
  // `content` is HTML when `type` is `StructuredProse`
  content: string
}

export interface Route {
  blocks: Block[]
  method: Method
  route: string
  id: string
}

export enum Method {
  POST = 'post',
  GET = 'get',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch',
}

export const methods = Object
  .keys(Method)
  .filter((item) => isNaN(Number(item)))
  .map(v => v.toLowerCase())

export interface SerializedState {
  envs: { key: string, value: string }[]
  routes: Route[]
}

export interface State extends SerializedState {
  changeBlock: (routeID: string, index: number, block: Partial<Omit<Block, 'id'>>) => void
  changeRoute: (id: string, route: Partial<Omit<Route, 'id'>>) => void
  deleteRoute: (id: string) => void
  addRoute: () => void
  setEnvs: (envs: { key: string, value: string }[]) => void
  changeEnv: (pair: { key: string, value: string }, idx: number) => void
}

function createBlock(type: BlockType): Block {
  return {
    type,
    content: '',
    id: nanoid(),
  }
}

function getDefaultRoute(): Route {
  return {
    blocks: [
      createBlock('RequestBody'),
      createBlock('StructuredProse'),
      createBlock('StructuredProse'),
    ],
    method: Method.POST,
    route: '/',
    id: nanoid(),
  }
}

function getDefaultState(): SerializedState {
  return {
    envs: [{ key: '', value: '' }],
    routes: [getDefaultRoute()],
  }
}

export function getTypedState(data?: Prisma.JsonValue): SerializedState | undefined {
  if (!data) return
  if ('state' in (data as any)) {
    return (data as any)['state'] as SerializedState
  }
}

export function createStore(project: projects, client?: SupabaseClient<Database>) {
  const initialState = getTypedState(project.data) || getDefaultState()

  if (initialState.routes.length === 0) {
    initialState.routes.push(getDefaultRoute())
  }

  if (!initialState.envs) {
    initialState.envs = [{ key: '', value: '' }]
  } else if (initialState.envs.length === 0) {
    initialState.envs.push({ key: '', value: '' })
  }

  const immerStore = immer<State>((set, get) => ({
    ...initialState,
    addRoute: () => set(state => {
      state.routes.push(getDefaultRoute())
    }),
    deleteRoute: (id) => set(state => {
      const idx = state.routes.findIndex(r => r.id === id)
      state.routes.splice(idx, 1)
    }),
    changeRoute: (id, route) => set(state => {
      const idx = state.routes.findIndex(r => r.id === id)
      if (idx !== -1) {
        state.routes[idx] = {
          ...state.routes[idx],
          ...route,
        }
      }
    }),
    changeBlock: (routeID, index, block) => set(state => {
      const idx = state.routes.findIndex(r => r.id === routeID)
      if (idx !== -1) {
        state.routes[idx].blocks[index] = {
          ...state.routes[idx].blocks[index],
          ...block,
        }
      }
    }),
    setEnvs: (envs) => set(state => {
      state.envs = envs
    }),
    changeEnv: (pair, idx) => set(state => {
      state.envs[idx] = pair
    }),
  }))

  const persistent = persist(immerStore, {
    name: 'supabase-persistence',
    partialize: (state) => state,
    storage: client ? {
      getItem: async (name) => {
        // We retrieve the data on the server
        return null
      },
      removeItem: async () => {
        // TODO: SECURITY - Enable row security for all tables and configure access to projects.
        const res = await client.from(projectsTable).update({ data: {} }).eq('id', project.id).single()
        if (res.error) {
          throw res.error
        }
      },
      setItem: async (name, value) => {
        // TODO: SECURITY - Enable row security for all tables and configure access to projects.
        const res = await client.from(projectsTable).update({ data: value as any }).eq('id', project.id)
        if (res.error) {
          throw res.error
        }
      },
    } : undefined,
  })

  const useStore = create<State, [['zustand/persist', unknown], ['zustand/immer', never]]>(persistent)
  return useStore
}
