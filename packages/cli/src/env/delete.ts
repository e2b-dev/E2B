import client from '../api'

const deleteEnv = client
  .path('/envs/{codeSnippetID}')
  .method('delete')
  .create({ api_key: true })

export async function deleteEnvironment({ id, apiKey }: { id: string; apiKey: string }) {
  await deleteEnv({
    api_key: apiKey,
    codeSnippetID: id,
  })
}
