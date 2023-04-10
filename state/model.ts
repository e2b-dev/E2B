export enum ModelProvider {
  OpenAI = 'OpenAI'
}

export interface ModelConfig {
  provider: ModelProvider
  name: string
  max_tokens: number
  temperature: number
  requiredFields?: string[]
}

const defaultTokens = 2048
const defaultTemperature = 0

export const models: { [model in keyof typeof ModelProvider]: Omit<ModelConfig, 'provider'>[] } = {
  [ModelProvider.OpenAI]: [
    {
      name: 'gpt-3.5-turbo',
      max_tokens: defaultTokens,
      temperature: defaultTemperature,
    },
    {
      name: 'gpt-4',
      max_tokens: defaultTokens,
      temperature: defaultTemperature,
    },
  ],
}
