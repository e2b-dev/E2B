import { Creds } from 'hooks/useModelProviderArgs'

import { PromptFragment } from './prompt'
import { TemplateID, templates } from './template'

export enum ModelProvider {
  OpenAI = 'OpenAI',
  Replicate = 'Replicate',
  Anthropic = 'Anthropic',
  HuggingFace = 'HuggingFace',
  Banana = 'Banana',
  AzureOpenAI = 'AzureOpenAI'
}

export interface ModelConfig extends Model {
  args: ModelArgs
  prompt: PromptFragment[]
}

export type ArgValue = string | number

export interface ModelArgs {
  [arg: string]: ArgValue | undefined
}

export interface ModelTemplateArg {
  label?: string
  editable?: boolean
  type: 'string' | 'number'
  // If this property is defined it is used as a default value.
  value?: ArgValue
  min?: number
  max?: number
  step?: number
  placeholder?: string
  optional?: boolean
}

export interface ProviderTemplateCreds {
  [key: string]: Omit<ModelTemplateArg, 'editable' | 'value'>
}

export interface Model {
  provider: ModelProvider
  name: string
}

export interface ModelTemplate extends Model {
  /**
   * Args should be exactly the same as the args to the langchain's model class in Python.
   */
  args?: { [arg: string]: ModelTemplateArg }
}

export interface ProviderTemplate {
  // These creds are merged with the model args then send to the API.
  creds?: ProviderTemplateCreds
  models: Omit<ModelTemplate, 'provider'>[]
  link?: string
}

export const providerTemplates: {
  [provider in keyof typeof ModelProvider]: ProviderTemplate
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
          max_length: {
            type: 'number',
            editable: true,
            step: 1,
            min: 1,
            value: 250,
            optional: true
          },
          temperature: {
            editable: true,
            type: 'number',
            value: 1,
            min: 0,
            max: 100,
            step: 0.01,
            optional: true
          },
          top_p: {
            editable: true,
            type: 'number',
            min: 0,
            step: 0.01,
            optional: true
          },
          top_k: {
            editable: true,
            type: 'number',
            min: 0,
            step: 1,
            optional: true
          },
          repetition_penalty: {
            editable: true,
            type: 'number',
            value: 1,
            min: 0,
            max: 100,
            step: 0.01,
            optional: true
          },
          max_time: {
            editable: true,
            type: 'number',
            min: 0,
            max: 120,
            step: 0.01,
            optional: true
          },
        },
      },
      {
        name: 'Inference Endpoints',
        args: {
          endpoint_url: {
            editable: true,
            type: 'string',
            label: 'Endpoint URL',
            placeholder: '...endpoints.huggingface.cloud',
          },
          max_length: {
            type: 'number',
            editable: true,
            step: 1,
            min: 1,
            value: 250,
            optional: true
          },
          temperature: {
            editable: true,
            type: 'number',
            value: 1,
            min: 0.01,
            max: 100,
            step: 0.01,
            optional: true
          },
          top_p: {
            editable: true,
            type: 'number',
            min: 0,
            step: 0.01,
            optional: true
          },
          top_k: {
            editable: true,
            type: 'number',
            min: 0,
            step: 1,
            optional: true
          },
          repetition_penalty: {
            editable: true,
            type: 'number',
            value: 1,
            min: 0,
            max: 100,
            step: 0.01,
            optional: true
          },
          max_time: {
            editable: true,
            type: 'number',
            min: 0,
            max: 120,
            step: 0.01,
            optional: true
          },
        },
      },
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
  [ModelProvider.Banana]: {
    link: 'https://banana.dev',
    creds: {
      banana_api_key: {
        label: 'Banana API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Hosted model',
        args: {
          model_key: {
            placeholder: 'xxxx-xxxx-xxxx-xxxx',
            editable: true,
            type: 'string',
            label: 'Model Key'
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
  [ModelProvider.AzureOpenAI]: {
    link: 'https://azure.microsoft.com/en-us/products/cognitive-services/openai-service',
    creds: {
      openai_api_key: {
        label: 'Azure OpenAI API Key',
        type: 'string',
      },
      openai_api_version: {
        label: 'Azure OpenAI API version',
        type: 'string',
      },
      openai_api_base: {
        label: 'Azure OpenAI API base',
        type: 'string',
      }

    },
    models: [
      {
        name: 'Hosted model',
        args: {
          model_name: {
            label: "Model name",
            type: 'string',
            value: 'gpt-3.5-turbo',
            editable: true,
          },
          deployment_name: {
            label: "Deployment name",
            type: 'string',
            value: 'gpt-3.5-turbo',
            editable: true,
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
      }
    ],
  }
}

export function getModelArgs(
  modelConfig: Pick<ModelConfig, 'provider' | 'name' | 'args'>,
  creds: Creds,
): ModelArgs {
  const template = providerTemplates[modelConfig.provider]?.models.find(m => m.name === modelConfig.name)
  if (!template) throw new Error(`Cannot find model template ${modelConfig.provider}/${modelConfig.name}`)

  const defaultArgs = Object
    .entries(template.args || {})
    .reduce<ModelArgs>((prev, [key, info]) => {
      if (info.value !== undefined) {
        prev[key] = info.value
      }
      return prev
    }, {})

  return {
    ...defaultArgs,
    ...creds[modelConfig.provider]?.creds,
    ...modelConfig.args,
  }
}

export const defaultModelProvider = ModelProvider.OpenAI
export const defaultModelName = providerTemplates[defaultModelProvider].models[0].name

export function getMissingCreds(provider: ModelProvider, creds: Creds) {
  return Object
    .entries(providerTemplates[provider]?.creds || {})
    .filter(([key]) => creds[provider]?.creds?.[key] === undefined)
}

export function getDefaultModelConfig(templateID: TemplateID): ModelConfig {
  const prompt = templates[templateID].prompt
  return {
    provider: defaultModelProvider,
    name: defaultModelName,
    args: {},
    prompt,
  }
}

export function isModelEqual(m1: Model, m2: Model) {
  return m1.provider === m2.provider && m1.name === m2.name
}
