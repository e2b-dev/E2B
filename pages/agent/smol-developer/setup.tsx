import {
  useState,
  useCallback,
  useEffect,
} from 'react'
import useSWRMutation from 'swr/mutation'
import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import {
  useUser,
  useSupabaseClient,
} from '@supabase/auth-helpers-react'

import Steps from 'components/Steps'
import SelectRepository from 'components/SelectRepository'
import AgentInstructions from 'components/AgentInstructions'
import { serverCreds } from 'db/credentials'
import { useGitHubClient } from 'hooks/useGitHubClient'
import { useRepositories } from 'hooks/useRepositories'
import { useLocalStorage } from 'hooks/useLocalStorage'
import useListenOnMessage from 'hooks/useListenOnMessage'
import { TemplateID } from 'state/template'
import { Creds } from 'hooks/useModelProviderArgs'
import { getDefaultModelConfig, getModelArgs, ModelConfig } from 'state/model'
import { GitHubAccount } from 'utils/github'
import { nanoid } from 'nanoid'
import { RepoSetup } from 'components/SelectRepository/RepoSetup'
import { html2markdown } from 'editor/schema'

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
  { name: 'Your Instructions', status: 'upcoming' },
  { name: 'Deploy AI Developer', status: 'upcoming' },
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
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>('gh_access_token', undefined)
  const github = useGitHubClient(accessToken)
  const [githubAccounts, setGitHubAccounts] = useState<GitHubAccount[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedRepository, setSelectedRepository] = useState<RepoSetup>()
  const { repos, refetch } = useRepositories(github)
  const [instructions, setInstructions] = useState('')
  const [openAIAPIKey, setOpenAIAPIKey] = useState<string>('')

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

  async function deployAgent() {
    if (!selectedRepository) {
      console.error('No repository selected')
      return
    }
    if (!instructions) {
      console.error('No instructions provided')
      return
    }
    if (!openAIAPIKey) {
      console.error('No OpenAI API key provided')
      return
    }
    console.log('DEPLOY AGENT', selectedRepository, instructions, openAIAPIKey)

    const modelConfig = getSmolDevModelConfig({
      OpenAI: {
        creds: {
          openai_api_key: openAIAPIKey,
        },
      },
    })

    // Transform instruction from prosemirror XML to markdown
    const [mdBody] = html2markdown(instructions)

    await createAgent({
      defaultBranch: selectedRepository.defaultBranch,
      installationID: selectedRepository.installationID,
      owner: selectedRepository.owner,
      repo: selectedRepository.repo,
      repositoryID: selectedRepository.repositoryID,
      title: 'Smol PR',
      branch: `pr/smol-dev/${nanoid(6).toLowerCase()}`,
      body: mdBody.trim(),
      commitMessage: 'Smol dev initial commit',
      modelConfig,
    })
  }

  function nextStep() {
    setCurrentStep(val => {
      const newVal = val + 1
      steps[val].status = 'complete'
      steps[newVal].status = 'current'
      return newVal
    })
  }

  function previousStep() {
    setCurrentStep(val => {
      const newVal = val - 1
      steps[val].status = 'upcoming'
      steps[newVal].status = 'current'
      return newVal
    })

  }

  function handleRepoSelection(repo: any) {
    setSelectedRepository(repo)
    nextStep()
  }

  async function signOut() {
    await supabaseClient.auth.signOut()
    location.reload()
  }

  useEffect(function getGitHubAccounts() {
    async function getAccounts() {
      if (!github) return
      const installations = await github.apps.listInstallationsForAuthenticatedUser()
      const accounts: GitHubAccount[] = []
      installations.data.installations.forEach(i => {
        if (i.account) {
          const ghAccType = (i.account as any)['type']
          const ghLogin = (i.account as any)['login']
          // Filter out user accounts that are not the current user (when a user has access to repos that aren't theirs)
          if (ghAccType === 'User' && ghLogin !== user?.user_metadata?.user_name) return
          accounts.push({ name: ghLogin, isOrg: ghAccType === 'Organization', installationID: i.id })
        }
      })
      setGitHubAccounts(accounts)
    }
    getAccounts()
  }, [github, user])

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
        {currentStep === 0 && (
          <SelectRepository
            repos={repos}
            onRepoSelection={handleRepoSelection}
            accessToken={accessToken}
            githubAccounts={githubAccounts}
          />
        )}
        {currentStep === 1 && (
          <AgentInstructions
            value={instructions}
            onChange={setInstructions}
            onBack={previousStep}
            onNext={nextStep}
          />
        )}
        {currentStep === 2 && (
          <div>
            <button
              className="w-8 min-w-[64px] h-[24px] min-h-[24px] flex items-center justify-center rounded bg-white/10 px-2 py-1 text-sm text-white font-medium hover:bg-white/20"
              onClick={deployAgent}
            >
              <span>Deploy</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Setup
