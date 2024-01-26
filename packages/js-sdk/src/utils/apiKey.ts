import { AuthenticationError } from '../error'

export function getApiKey(apiKey?: string): string {
  apiKey = apiKey || process?.env?.E2B_API_KEY

  if (!apiKey) {
    throw new AuthenticationError(
      'API key is required, please visit https://e2b.dev/docs to get your API key. ' +
      'You can either set the environment variable `E2B_API_KEY` ' +
      "or you can pass it directly to the sandbox like Sandbox.create({apiKey: 'e2b_...'})",
    )
  }

  return apiKey
}