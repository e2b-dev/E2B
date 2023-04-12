import { Creds } from 'hooks/useModelProviderCreds'
import { ModelInfo } from './store'

export enum ModelProvider {
  OpenAI = 'OpenAI',
  Replicate = 'Replicate',
}

export type ArgValue = string | number

export interface EvaluatedArgs {
  [arg: string]: ArgValue | undefined
}

export interface ModelArg {
  label?: string
  editable?: boolean
  type: 'string' | 'number'
  // If this property is defined it is used as a default value.
  value?: ArgValue
}

export interface ModelConfig {
  provider: ModelProvider
  name: string
  /**
   * Args should be exactly the same as the args to the langchain's model class in Python.
   */
  args?: { [arg: string]: ModelArg }
}

export const models: {
  [model in keyof typeof ModelProvider]: {
    // These creds are merged with the model args then send to the API.
    creds?: { [key: string]: Omit<ModelArg, 'editable' | 'value'> }
    models: Omit<ModelConfig, 'provider'>[]
  }
} = {
  [ModelProvider.Replicate]: {
    creds: {
      replicate_api_token: {
        label: 'Replicate API Key',
        type: 'string',
      },
    },
    models: [
      {
        name: 'Deployed model',
        args: {
          model: {
            editable: true,
            type: 'string',
            label: 'Model name'
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

export interface EvaluatedModelConfig extends Omit<ModelConfig, 'args' | 'name'> {
  args: EvaluatedArgs
}

export function evaluateModelConfig(
  config: ModelInfo,
  creds: Creds,
): EvaluatedModelConfig | undefined {
  const model = models[config.provider].models.find(m => m.name === config.name)
  if (!model) return

  const defaultArgs = Object
    .entries(model.args || {})
    .reduce<EvaluatedArgs>((prev, [key, info]) => {
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
      ...config.userArgs,
    }
  }
}

export function getMissingCreds(provider: ModelProvider, creds: Creds) {
  const missing = Object
    .entries(models[provider]?.creds || {})
    .filter(([key, val]) => creds[provider]?.creds?.[key] === undefined)

  return missing
}
