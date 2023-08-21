import { smolDeveloperTemplateID } from 'utils/smolTemplates'

export async function handlePostAgent(url: string, { arg }: { arg: PostAgentBody }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PostAgentResponse
}

export interface PostAgentBody {
  installationID: number
  repositoryID: number
  title: string
  defaultBranch: string
  body: string
  owner: string
  repo: string
  branch: string
  commitMessage: string
  templateID: typeof smolDeveloperTemplateID
  openAIKey?: string
  openAIModel: string
}

export interface PostAgentResponse {
  issueID: number
  owner: string
  repo: string
  pullURL: string
  pullNumber: number
  projectID: string
  projectSlug: string
}