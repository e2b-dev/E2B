import { Creds } from 'hooks/useModelProviderCreds'

import { SelectedModel } from './store'

export enum ModelProvider {
  OpenAI = 'OpenAI',
  Replicate = 'Replicate',
  HuggingFace = 'HuggingFace',
}

export type ArgValue = string | number

export interface ModelArgs {
  [arg: string]: ArgValue | undefined
}

export interface ModelArgTemplate {
  label?: string
  editable?: boolean
  type: 'string' | 'number'
  // If this property is defined it is used as a default value.
  value?: ArgValue
  min?: number
  max?: number
  step?: number
}

export interface ModelConfigTemplate {
  provider: ModelProvider
  name: string
  /**
   * Args should be exactly the same as the args to the langchain's model class in Python.
   */
  args?: { [arg: string]: ModelArgTemplate }
}

export const models: {
  [provider in keyof typeof ModelProvider]: {
    // These creds are merged with the model args then send to the API.
    creds?: { [key: string]: Omit<ModelArgTemplate, 'editable' | 'value'> }
    models: Omit<ModelConfigTemplate, 'provider'>[]
  }
} = {
  [ModelProvider.HuggingFace]: {
    creds: {
      huggingfacehub_api_token: {
        label: 'Hugging Face API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Deployed model',
        args: {
          endpoint_url: {
            editable: true,
            type: 'string',
            label: 'Endpoint URL'
          },
        },
      },
    ],
  },
  [ModelProvider.Replicate]: {
    creds: {
      replicate_api_token: {
        label: 'Replicate API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Deployed model [Work in Progress]',
        args: {
          model: {
            editable: true,
            type: 'string',
            label: 'Model'
          },
          max_length: {
            type: 'number',
            value: 4096,
            step: 1,
            min: 1,
          },
          temperature: {
            label: 'Temperature',
            editable: true,
            type: 'number',
            value: 0.4,
            min: 0.01,
            max: 5,
            step: 0.01,
          },
          top_p: {
            label: 'Top P',
            editable: true,
            type: 'number',
            value: 0.9,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
          repetition_penalty: {
            label: 'Repetition penalty',
            editable: true,
            type: 'number',
            value: 1.1,
            min: 0.01,
            max: 5,
            step: 0.01,
          },
        },
      },
    ],
  },
  [ModelProvider.OpenAI]: {
    creds: {
      openai_api_key: {
        label: 'OpenAI API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'GPT 3.5 Turbo',
        args: {
          model_name: {
            type: 'string',
            value: 'gpt-3.5-turbo',
          },
          max_tokens: {
            type: 'number',
            value: 2048,
          },
          temperature: {
            type: 'number',
            value: 0,
          },
        },
      },
      {
        name: 'GPT 4',
        args: {
          model_name: {
            type: 'string',
            value: 'gpt-4',
          },
          max_tokens: {
            type: 'number',
            value: 2048,
          },
          temperature: {
            type: 'number',
            value: 0,
          },
        },
      },
    ],
  },
}

export interface ModelConfig extends Omit<ModelConfigTemplate, 'args' | 'name'> {
  args: ModelArgs
}

export function getModelConfig(
  config: SelectedModel,
  creds: Creds,
): ModelConfig | undefined {
  const model = models[config.provider].models.find(m => m.name === config.name)
  if (!model) return

  const defaultArgs = Object
    .entries(model.args || {})
    .reduce<ModelArgs>((prev, [key, info]) => {
      if (info.value !== undefined) {
        prev[key] = info.value
      }
      return prev
    }, {})

  return {
    provider: config.provider,
    args: {
      ...defaultArgs,
      ...creds[config.provider]?.creds,
      ...config.args,
    }
  }
}

export function getMissingCreds(provider: ModelProvider, creds: Creds) {
  const missing = Object
    .entries(models[provider]?.creds || {})
    .filter(([key, val]) => creds[provider]?.creds?.[key] === undefined)

  return missing
}
