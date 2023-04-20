import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
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

export interface TemplateBlock {
  type: 'text' | 'xml'
  // `content` must be valid HTML when `type` is `Description` or `Instructions`
  content: string
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

export interface SerializedState {
  envs: { key: string, value: string }[]
  blocks: { [key: string]: TemplateBlock }
  model: SelectedModel
  modelSetups: ModelSetup[]
}

export interface EnvVar {
  key: string
  value: string
}

export interface State extends SerializedState {
  setBlock: (key: string, block: Partial<TemplateBlock>) => void
  setEnvs: (pair: EnvVar[]) => void
  setEnv: (pair: EnvVar, idx: number) => void
  setModel: (model: SelectedModel) => void
  setPrompt: (templateID: string, provider: ModelProvider, modelName: string, idx: number, promptPart: PromptPart) => void
}

function getDefaultModel(): SelectedModel {
  return {
    provider: ModelProvider.OpenAI,
    name: defaultModelName,
    args: {},
  }
}

function getDefaultModelSetup(): ModelSetup[] {
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
    model: getDefaultModel(),
    modelSetups: getDefaultModelSetup(),
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

  if (!initialState.envs || initialState.envs.length === 0) {
    initialState.envs = [{ key: '', value: '' }]
  }

  if (!initialState.modelSetups) {
    initialState.modelSetups = getDefaultModelSetup()
  }

  // TEMPORARY: We are checking .model === string for backwards compatibility.
  if (!initialState.model || typeof initialState.model === 'string') {
    initialState.model = getDefaultModel()
  }

  const immerStore = immer<State>((set, get) => ({
    ...initialState,
    setBlock: (key, block) => set(state => {
      state.blocks[key] = {
        ...state.blocks[key],
        ...block,
      }
    }),
    setEnvs: (envs) => set(state => {
      state.envs = envs
    }),
    setEnv: (pair, idx) => set(state => {
      state.envs[idx] = pair
    }),
    setModel: (model) => set(state => {
      const modelSetupIdx = state.modelSetups.findIndex(p =>
        p.templateID === defaultTemplateID &&
        p.provider === model.provider &&
        p.modelName === model.name,
      )

      if (modelSetupIdx === -1) {
        state.modelSetups.push({
          provider: model.provider,
          templateID: defaultTemplateID,
          prompt: defaultPromptTemplate,
          modelName: model.name,
        })
      }
      state.model = model
    }),
    setPrompt: (templateID, provider, modelName, idx, promptPart) => set(state => {
      let modelSetupIdx = state.modelSetups.findIndex(p =>
        p.templateID === templateID &&
        p.provider === provider &&
        p.modelName === modelName
      )

      if (modelSetupIdx === -1) {
        state.modelSetups.push({
          provider,
          templateID: defaultTemplateID,
          prompt: defaultPromptTemplate,
          modelName,
        })
        modelSetupIdx = 0
      }
      state.modelSetups[modelSetupIdx].prompt[idx] = promptPart
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
