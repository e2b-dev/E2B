import {
  useState,
  useCallback,
} from 'react'
import useSWRMutation from 'swr/mutation'
import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

import Steps from 'components/Steps'
import SelectRepository from 'components/SelectRepository'
import { serverCreds } from 'db/credentials'
import { useGitHubClient } from 'hooks/useGitHubClient'
import { useRepositories } from 'hooks/useRepositories'
import { useLocalStorage } from 'hooks/useLocalStorage'
import useListenOnMessage from 'hooks/useListenOnMessage'
import { TemplateID } from 'state/template'
import { Creds } from 'hooks/useModelProviderArgs'
import { getDefaultModelConfig, getModelArgs, ModelConfig } from 'state/model'

export interface PostAgentBody {
  // ID of the installation of the GitHub App
  installationID: number
  // ID of the repository
  repositoryID: number
  // Title of the PR
  title: string
  // Default branch against which to create the PR
  defaultBranch: string
  // Initial prompt used as a body text for the PR (can be markdown)
  body: string
  // Owner of the repo (user or org)
  owner: string
  // Name of the repo
  repo: string
  // Name of the branch created for the PR
  branch: string
  // Commit message for the PR first empty commit
  commitMessage: string
  modelConfig: ModelConfig & { templateID: TemplateID }
}

const steps = [
  { name: 'Select Repository', status: 'current' },
  { name: 'Write Instructions', status: 'upcoming' },
  { name: 'Step 3', status: 'upcoming' },
]

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerSupabaseClient(ctx, serverCreds)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return {
      redirect: {
        destination: '/agent/smol-developer',
        permanent: false,
      },
    }
  }

  return { props: {} }
}

export interface PostAgentResponse {
  issueID: number
  owner: string
  repo: string
  pullURL: string
  pullNumber: number
}

async function handlePostAgent(url: string, { arg }: { arg: PostAgentBody }) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return await response.json() as PostAgentResponse
}


function getSmolDevModelConfig(creds: Creds): ModelConfig & { templateID: TemplateID } {
  const templateID = TemplateID.SmolDeveloper
  const modelConfig = getDefaultModelConfig(templateID)
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    args: getModelArgs(modelConfig, creds),
    prompt: [],
    templateID,
  }
}
function Setup() {
  const supabaseClient = useSupabaseClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedRepository, setSelectedRepository] = useState<any | undefined>()
  // const supabaseClient = useSupabaseClient()
  // const session = useSession()
  // const sessionCtx = useSessionContext()
  // const [selectedRepo, setSelectedRepo] = useState<RepoSetup>()

  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>('gh_access_token', undefined)
  const gitHub = useGitHubClient(accessToken)
  const { repos, refetch } = useRepositories(gitHub)

  const handleMessageEvent = useCallback((event: MessageEvent) => {
    if (event.data.accessToken) {
      setAccessToken(event.data.accessToken)
    } else if (event.data.installationID) {
      refetch()
    }
  }, [refetch, setAccessToken])
  useListenOnMessage(handleMessageEvent)

  const {
    trigger: createAgent,
  } = useSWRMutation('/api/agent', handlePostAgent)

  // async function deployAgent() {
  //   if (!selectedRepo) return
  //   console.log('selectedRepo', selectedRepo)


  //   return
  //   await createAgent({
  //     defaultBranch: selectedRepo.defaultBranch,
  //     installationID: selectedRepo.installationID,
  //     owner: selectedRepo.owner,
  //     repo: selectedRepo.repo,
  //     repositoryID: selectedRepo.repositoryID,
  //     title,
  //     branch,
  //     body,
  //     commitMessage,
  //   })
  // }

  function handleRepoSelection(repo: any) {
    console.log('SELECTED REPO', repo)
    setSelectedRepository(repo)
    setCurrentStep(val => {
      const newVal = val + 1
      steps[val].status = 'complete'
      steps[newVal].status = 'current'
      return newVal
    })
  }

  async function signOut() {
    await supabaseClient.auth.signOut()
    location.reload()
  }

  return (
    <div className="h-full flex flex-col items-center justify-start bg-gray-800 py-8 px-6">
      <div className="mb-4 w-full flex items-center justify-between">
        <span />
        <button
          className="text-sm font-semibold text-white"
          onClick={signOut}
        >
          Log out
        </button>
      </div>
      <div className="overflow-hidden flex-1 mx-auto w-full max-w-lg flex flex-col">
        <Steps steps={steps} />
        <div className="h-px bg-gray-700 my-8" />

        {currentStep === 0 ? (
          <SelectRepository
            repos={repos}
            onRepoSelection={handleRepoSelection}
            accessToken={accessToken}
          />
        ) : currentStep === 1 ? (
          <div>prompt</div>
        ) : currentStep === 2 ? (
          <div>keys + deploy</div>
        ) : null}
      </div>
    </div>
  )
}

export default Setup
