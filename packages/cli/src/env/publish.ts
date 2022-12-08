import client from '../api'

const publishEnv = client
  .path('/envs/{codeSnippetID}')
  .method('patch')
  .create({ api_key: true })

export async function publishEnvironment({ id, apiKey }: { id: string; apiKey: string }) {
  await publishEnv({
    api_key: apiKey,
    codeSnippetID: id,
  })
}
