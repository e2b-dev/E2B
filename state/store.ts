import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { projects, Prisma } from '@prisma/client'
import { WritableDraft } from 'immer/dist/internal'

import { Database } from 'db/supabase'
import { projectsTable } from 'db/tables'

import { ModelConfig, getDefaultModelConfig, Model } from './model'
import { PromptFragment } from './prompt'
import { defaultTemplateID, TemplateID, templates } from './template'
import { EnvVar, getDefaultEnv } from './envs'
import { InstructionsRoot } from './instruction'

export interface SerializedState {
  instructions: InstructionsRoot
  envs: { key: string, value: string }[]
  modelConfigs: ModelConfig[]
  templateID: TemplateID
  selectedModel: Model
}

export interface State extends SerializedState {
  setInstructions: (set: (nextStateOrUpdater: InstructionsRoot | Partial<InstructionsRoot> | ((state: WritableDraft<InstructionsRoot>) => void)) => void) => void
  setEnvs: (pair: EnvVar[]) => void
  setEnv: (pair: EnvVar, idx: number) => void
  setModelConfigPrompt: (config: Model, idx: number, prompt: Partial<PromptFragment>) => void
  setModelConfig: (config: Partial<ModelConfig> & Model) => void
  selectedModelConfig: ModelConfig | undefined
  selectModel: (model: Model) => void
}

function getDefaultState(templateID: TemplateID): SerializedState {
  const prompt = templates[templateID].prompt
  const defaultModel = getDefaultModelConfig()

  return {
    envs: [getDefaultEnv()],
    modelConfigs: [{
      ...defaultModel,
      prompt,
    }],
    instructions: {},
    templateID,
    selectedModel: {
      name: defaultModel.name,
      provider: defaultModel.provider,
    }
  }
}

export function getTypedState(data?: Prisma.JsonValue): SerializedState | undefined {
  if (!data) return
  if ('state' in (data as any)) {
    return (data as any)['state'] as SerializedState
  }
}

export function createStore(project: projects, client?: SupabaseClient<Database>) {
  const initialState = getTypedState(project.data) || getDefaultState(defaultTemplateID)

  if (!initialState.envs?.length) {
    initialState.envs = [getDefaultEnv()]
  }

  if (!initialState.modelConfigs) {
    initialState.modelConfigs = [{
      ...getDefaultModelConfig(),
      prompt: templates[defaultTemplateID].prompt,
    }]
  }

  if (!initialState.selectedModel) {
    const defaultModel = getDefaultModelConfig()
    initialState.selectedModel = {
      provider: defaultModel.provider,
      name: defaultModel.name,
    }
  }

  const immerStore = immer<State>((set, get) => ({
    ...initialState,
    setInstructions: transform => set(state => transform(state.instructions)),
    setEnvs: (envs) => set(state => state.envs = envs),
    setEnv: (pair, idx) => set(state => state.envs[idx] = pair),
    selectModel: (model) => set(state => {
      state.selectedModel = {
        provider: model.provider,
        name: model.name
      }
    }),
    setModelConfigPrompt: (config, idx, prompt) => set(state => {
      const existingConfigIndex = state.modelConfigs.findIndex(c =>
        c.provider === config.provider &&
        c.name === config.name,
      )

      if (existingConfigIndex !== -1) {
        const configPrompt = state.modelConfigs[existingConfigIndex].prompt
        if (configPrompt.length > idx) {
          configPrompt[idx] = {
            ...configPrompt[idx],
            ...prompt,
          }
          return
        }
      }
      console.error('Invalid index when setting model config prompt', config, idx)
    }),
    setModelConfig: (config) => set(state => {
      const existingConfigIndex = state.modelConfigs.findIndex(c =>
        c.provider === config.provider &&
        c.name === config.name,
      )

      if (existingConfigIndex === -1) {
        state.modelConfigs.push({
          args: {},
          prompt: [],
          ...config,
        })
      } else {
        state.modelConfigs[existingConfigIndex] = {
          ...state.modelConfigs[existingConfigIndex],
          ...config
        }
      }
    }),
    get selectedModelConfig() {
      const state = get()
      const model = state.selectedModel
      return state.modelConfigs.find(c =>
        c.provider === model.provider &&
        c.name === model.name,
      )
    },
  }))

  const persistent = persist(immerStore, {
    name: 'supabase-persistence',
    storage: client ? {
      // We retrieve the data on the server
      getItem: () => null,
      removeItem: () => { },
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
