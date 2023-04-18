import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'
import { projects, Prisma } from '@prisma/client'

import { Database } from 'db/supabase'
import { projectsTable } from 'db/tables'

import { ModelArgs, ModelProvider } from './model'
import { defaultPromptTemplate } from './prompt'

export interface SelectedModel {
  provider: ModelProvider
  args: ModelArgs
  name: string
}

export const defaultTemplateID = 'NodeJSServer'
export const defaultModelName: 'GPT 3.5 Turbo' = 'GPT 3.5 Turbo'

export type BlockType =
  // Raw text
  'Basic' |
  // Code that looks like TypeScript interface definition without the outer parenthesses.
  'RequestBody' |
  'Description' |
  'Instructions'

export interface Block {
  id: string
  type: BlockType
  // `content` must be valid HTML when `type` is `Description` or `Instructions`
  content: string
}

export interface Route {
  blocks: Block[]
  method: Method
  route: string
  id: string
}

export interface PromptPart {
  role: 'user' | 'system'
  type: string
  content: string
}

export interface ModelSetup {
  templateID: string
  provider: ModelProvider
  modelName: string
  prompt: PromptPart[]
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
  model: SelectedModel
  modelSetups: ModelSetup[]
}

export interface State extends SerializedState {
  changeBlock: (routeID: string, index: number, block: Partial<Omit<Block, 'id'>>) => void
  changeRoute: (id: string, route: Partial<Omit<Route, 'id'>>) => void
  deleteRoute: (id: string) => void
  addRoute: () => void
  setEnvs: (envs: { key: string, value: string }[]) => void
  changeEnv: (pair: { key: string, value: string }, idx: number) => void
  setModel: (model: SelectedModel) => void
  setPrompt: (templateID: string, provider: ModelProvider, modelName: string, prompt: PromptPart[]) => void
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
      createBlock('Description'),
      createBlock('Instructions'),
    ],
    method: Method.POST,
    route: '/',
    id: nanoid(),
  }
}

function getDefaultModel(): SelectedModel {
  return {
    provider: ModelProvider.OpenAI,
    name: defaultModelName,
    args: {},
  }
}

function getDefaultPrompts(): ModelSetup[] {
  return [{
    provider: ModelProvider.OpenAI,
    modelName: defaultModelName,
    templateID: defaultTemplateID,
    prompt: defaultPromptTemplate,
  }]
}

function getDefaultState(): SerializedState {
  return {
    envs: [{ key: '', value: '' }],
    routes: [getDefaultRoute()],
    model: getDefaultModel(),
    modelSetups: getDefaultPrompts(),
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

  if (!initialState.modelSetups || !Array.isArray(initialState.modelSetups)) {
    initialState.modelSetups = getDefaultPrompts()
  }

  // TEMPORARY: We are checking .model === string for backwards compatibility.
  if (!initialState.model || typeof initialState.model === 'string') {
    initialState.model = getDefaultModel()
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
    setModel: (model) => set(state => {
      state.model = model
    }),
    changeEnv: (pair, idx) => set(state => {
      state.envs[idx] = pair
    }),
    setPrompt: (templateID, provider, modelName, prompt) => set(state => {
      const promptIdx = state.modelSetups.findIndex(p =>
        p.templateID === templateID &&
        p.provider === provider &&
        p.modelName === modelName
      )

      if (promptIdx !== -1) {
        state.modelSetups[promptIdx].prompt = prompt
      } else {
        state.modelSetups.push({
          templateID,
          prompt,
          modelName,
          provider,
        })
      }
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

  return create<State, [['zustand/persist', unknown], ['zustand/immer', never]]>(persistent)
}
