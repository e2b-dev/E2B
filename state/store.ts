import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { SupabaseClient } from '@supabase/supabase-js'
import { projects, Prisma } from '@prisma/client'
import { WritableDraft } from 'immer/dist/internal'

import { Database } from 'db/supabase'
import { projectsTable } from 'db/tables'

import { ModelConfig, getDefaultModelConfig, Model, isModelEqual } from './model'
import { PromptFragment } from './prompt'
import { defaultTemplateID, TemplateID } from './template'
import { EnvVar, getDefaultEnv } from './envs'
import { Instructions, InstructionsTransform, TransformType } from './instruction'

export interface SerializedState {
  /**
   * This should be an object that contains information provided by a user that is then injected to prompt when you use "Run".
   * 
   * For example - the instructions for NodeJSExpress template contains an array of `Routes` that each has 
   * `Description`, `RequestBody`, `Instructions` (Step-by-step instructions), `Method` and `Path` fields.
   * You then inject these fields in the prompt via `{{Method}}` Mustache syntax.
   * 
   * This object's structure can be specific for each template so the default type is `any`.
   */
  instructions: Instructions
  /**
   * This field specifies which fields from `instructions` are XML 
   * and should be transformed to pure text before injected to prompt.
   */
  instructionsTransform: InstructionsTransform
  /**
   * Configuration (prompt, model args, etc.) for models.
   * 
   * The model's config is only added if the model was selected.
  */
  modelConfigs: ModelConfig[]
  envs: EnvVar[]
  templateID: TemplateID | null
  selectedModel: Model
}

export interface State extends SerializedState {
  /**
   * Because the instructions can be different for each template we expose an update function that can modify them.
   * @param updater function that can modify the current instructions via a provided immer.js draft object.
   */
  setInstructions: <T extends Instructions>(updater: (state: WritableDraft<T>) => void) => void
  setInstructionTransform: (jsonPath: string, transform?: TransformType) => void
  setEnvs: (pair: EnvVar[]) => void
  setEnv: (pair: EnvVar, idx: number) => void
  setModelConfigPrompt: (config: Model, idx: number, prompt: Partial<PromptFragment>) => void
  setModelConfig: (config: Partial<ModelConfig> & Model) => void
  selectModel: (model: Model) => void
  /**
   * TODO: We would ideally use a getter here but there are some problems with the zustand interactions.
   */
  getSelectedModelConfig: () => ModelConfig | null
}

export function getDefaultState(templateID: TemplateID): SerializedState {
  const defaultModelConfig = getDefaultModelConfig(templateID)

  return {
    instructionsTransform: {},
    envs: [getDefaultEnv()],
    modelConfigs: [defaultModelConfig],
    instructions: {},
    templateID,
    selectedModel: {
      name: defaultModelConfig.name,
      provider: defaultModelConfig.provider,
    },
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
    initialState.modelConfigs = [getDefaultModelConfig(defaultTemplateID)]
  }

  if (!initialState.selectedModel) {
    const firstConfig = initialState.modelConfigs[0]
    initialState.selectedModel = {
      name: firstConfig.name,
      provider: firstConfig.provider,
    }
  }

  const immerStore = immer<State>((set, get) => ({
    ...initialState,
    setInstructions: transform =>
      set(state => {
        transform(state.instructions)
      }),
    setInstructionTransform: (jsonPath, instructionTransform) =>
      set(state => {
        state.instructionsTransform[jsonPath] = instructionTransform
      }),
    setEnvs: (envs) =>
      set(state => {
        state.envs = envs
      }),
    setEnv: (pair, idx) =>
      set(state => {
        state.envs[idx] = pair
      }),
    selectModel: (model) =>
      set(state => {
        state.selectedModel = {
          provider: model.provider,
          name: model.name
        }

        // Ensure that the model config exists
        const existingConfigIndex = state.modelConfigs.findIndex(c => isModelEqual(c, model))
        if (existingConfigIndex === -1) {
          const templateID = get().templateID
          if (!templateID) throw new Error('No templateID for current project')
          state.modelConfigs.push({
            ...getDefaultModelConfig(templateID),
            provider: model.provider,
            name: model.name,
          })
        }
      }),
    setModelConfigPrompt: (config, idx, prompt) =>
      set(state => {
        const existingConfigIndex = state.modelConfigs.findIndex(c => isModelEqual(c, config))

        if (existingConfigIndex !== -1) {
          const config = state.modelConfigs[existingConfigIndex]
          if (config.prompt.length > idx) {
            config.prompt[idx] = {
              ...config.prompt[idx],
              ...prompt,
            }
            return
          }
        }
        console.error('Invalid index when setting model config prompt', config, idx)
      }),
    setModelConfig: (config) =>
      set(state => {
        const existingConfigIndex = state.modelConfigs.findIndex(c => isModelEqual(c, config))

        if (existingConfigIndex === -1) {
          const templateID = get().templateID
          if (!templateID) throw new Error('No templateID for current project')

          state.modelConfigs.push({
            ...getDefaultModelConfig(templateID),
            ...config,
          })
        } else {
          state.modelConfigs[existingConfigIndex] = {
            ...state.modelConfigs[existingConfigIndex],
            ...config
          }
        }
      }),
    getSelectedModelConfig: () => {
      const model = get().selectedModel
      return get().modelConfigs.find(c => isModelEqual(c, model)) || null
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
