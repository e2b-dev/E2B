import { Creds } from 'hooks/useModelProviderArgs'

import { SelectedModel } from './store'

export enum ModelProvider {
  OpenAI = 'OpenAI',
  Replicate = 'Replicate',
  Anthropic = 'Anthropic',
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
  placeholder?: string
}

export interface ProviderCredsTemplate {
  [key: string]: Omit<ModelArgTemplate, 'editable' | 'value'>
}

export interface ModelConfigTemplate {
  provider: ModelProvider
  name: string
  /**
   * Args should be exactly the same as the args to the langchain's model class in Python.
   */
  args?: { [arg: string]: ModelArgTemplate }
}

export interface ProviderTemplate {
  // These creds are merged with the model args then send to the API.
  creds?: ProviderCredsTemplate
  models: Omit<ModelConfigTemplate, 'provider'>[]
  link?: string
}

export const modelTemplates: {
  [provider in keyof typeof ModelProvider]?: ProviderTemplate
} = {
  [ModelProvider.Anthropic]: {
    link: 'https://anthropic.com',
    creds: {
      anthropic_api_key: {
        label: 'Anthropic API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Claude v1.3',
        args: {
          model: {
            value: 'claude-v1.3',
            type: 'string',
          },
          max_tokens_to_sample: {
            type: 'number',
            editable: true,
            label: 'Max tokens to sample',
            value: 2048,
            step: 1,
            min: 1,
          },
          temperature: {
            label: 'Temperature',
            editable: true,
            type: 'number',
            value: 0.4,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
          top_p: {
            label: 'top-p',
            editable: true,
            type: 'number',
            value: -1,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
          top_k: {
            label: 'top-k',
            editable: true,
            type: 'number',
            value: -1,
            min: 0,
            step: 1,
          },
        },
      },
      {
        name: 'Claude Instant v1',
        args: {
          model: {
            value: 'claude-instant-v1',
            type: 'string',
          },
          max_tokens_to_sample: {
            type: 'number',
            editable: true,
            label: 'Max tokens to sample',
            value: 2048,
            step: 1,
            min: 1,
          },
          temperature: {
            label: 'Temperature',
            editable: true,
            type: 'number',
            value: 0.4,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
          top_p: {
            label: 'top-p',
            editable: true,
            type: 'number',
            value: -1,
            min: 0.01,
            max: 1,
            step: 0.01,
          },
          top_k: {
            label: 'top-k',
            editable: true,
            type: 'number',
            value: -1,
            min: 0,
            step: 1,
          },
        },
      },
    ],
  },
  [ModelProvider.HuggingFace]: {
    link: 'https://huggingface.co',
    creds: {
      huggingfacehub_api_token: {
        label: 'Hugging Face API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Inference API',
        args: {
          repo_id: {
            editable: true,
            type: 'string',
            label: 'Repo ID',
            placeholder: 'owner-name/repo-name',
          },
        },
      },
      // {
      //   name: 'Inference Endpoints model',
      //   args: {
      //     endpoint_url: {
      //       editable: true,
      //       type: 'string',
      //       label: 'Endpoint URL',
      //       placeholder: '...endpoints.huggingface.cloud',
      //     },
      //   },
      // },
    ],
  },
  [ModelProvider.Replicate]: {
    link: 'https://replicate.com',
    creds: {
      replicate_api_token: {
        label: 'Replicate API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Hosted model',
        args: {
          model: {
            placeholder: 'owner-name/model-name:version',
            editable: true,
            type: 'string',
            label: 'Model'
          },
          max_length: {
            type: 'number',
            editable: true,
            value: 2500,
            step: 1,
            min: 1,
          },
          temperature: {
            editable: true,
            type: 'number',
            value: 0.5,
            min: 0,
            step: 0.01,
          },
          top_p: {
            editable: true,
            type: 'number',
            value: 0.9,
            min: 0,
            max: 1,
            step: 0.01,
          },
          top_k: {
            editable: true,
            type: 'number',
            value: 0,
            min: 0,
            step: 0.01,
          },
          repetition_penalty: {
            editable: true,
            type: 'number',
            value: 1,
            min: 0,
            step: 0.01,
          },
        },
      },
    ],
  },
  [ModelProvider.OpenAI]: {
    link: 'https://openai.com',
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
            label: 'Max tokens',
            type: 'number',
            value: 2048,
            editable: true,
          },
          temperature: {
            type: 'number',
            label: 'Temperature',
            value: 0.0,
            min: 0,
            step: 0.01,
            max: 2,
            editable: true,
          },
          presence_penalty: {
            type: 'number',
            label: 'Presence penalty',
            value: 0.0,
            min: -2,
            step: 0.01,
            max: 2,
            editable: true,
          },
          frequency_penalty: {
            type: 'number',
            label: 'Frequency penalty',
            value: 0.0,
            min: -2,
            step: 0.01,
            max: 2,
            editable: true,
          },
          top_p: {
            label: 'Top-p',
            type: 'number',
            value: 1,
            min: 0.0,
            max: 1,
            step: 0.01,
            editable: true,
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
            label: 'Max tokens',
            type: 'number',
            value: 2048,
            editable: true,
          },
          temperature: {
            type: 'number',
            label: 'Temperature',
            value: 0,
            min: 0.0,
            step: 0.01,
            max: 2,
            editable: true,
          },
          presence_penalty: {
            type: 'number',
            label: 'Presence penalty',
            value: 0.0,
            min: -2,
            step: 0.01,
            max: 2,
            editable: true,
          },
          frequency_penalty: {
            type: 'number',
            label: 'Frequency penalty',
            value: 0.0,
            min: -2,
            step: 0.01,
            max: 2,
            editable: true,
          },
          top_p: {
            label: 'Top-p',
            type: 'number',
            value: 1.0,
            min: 0,
            max: 1,
            step: 0.01,
            editable: true,
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
  const model = modelTemplates[config.provider]?.models.find(m => m.name === config.name)
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
    .entries(modelTemplates[provider]?.creds || {})
    .filter(([key,]) => creds[provider]?.creds?.[key] === undefined)

  return missing
}
