import { Creds } from 'hooks/useModelProviderCreds'

export enum ModelProvider {
  OpenAI = 'OpenAI',
  Replicate = 'Replicate',
}

export type ArgValue = string | number

export interface EvaluatedArgs {
  [arg: string]: ArgValue
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
        name: 'Custom model',
        args: {
          model_name: {
            editable: true,
            type: 'string',
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

interface EvaluatedModelConfig extends Omit<ModelConfig, 'args' | 'name'> {
  args: EvaluatedArgs
}

export function evaluateModelConfig(
  provider: ModelProvider,
  name: string,
  creds: Creds,
  userArgs: EvaluatedArgs,
): EvaluatedModelConfig | undefined {
  const model = models[provider].models.find(m => m.name === name)
  if (!model) return

  const defaultArgs = Object
    .entries(model.args || {})
    .reduce<EvaluatedArgs>((prev, [key, info]) => {
      if (info.value) {
        prev[key] = info.value
      }
      return prev
    }, {})

  return {
    provider,
    args: {
      ...defaultArgs,
      ...creds[provider]?.creds,
      ...userArgs,
    }
  }
}
