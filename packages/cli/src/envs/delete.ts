import { api } from '@devbookhq/sdk'

const deleteEnv = api
  .path('/envs/{codeSnippetID}')
  .method('delete')
  .create({ api_key: true })

export async function deleteEnvironment({ id, apiKey }: { id: string; apiKey: string }) {
  await deleteEnv({
    api_key: apiKey,
    codeSnippetID: id,
  })
}
