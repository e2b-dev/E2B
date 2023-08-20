'use client'

import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import {
  useSupabaseClient, useUser
} from '@supabase/auth-helpers-react'
import { nanoid } from 'nanoid'
import type { GetServerSideProps } from 'next'

import { usePostHog } from 'posthog-js/react'
import {
  useCallback,
  useEffect, useState
} from 'react'
import useSWRMutation from 'swr/mutation'

import AgentInstructions from 'components/AgentInstructions'
import ChooseOpenAIKey from 'components/ChooseOpenAIKey'
import DeployAgent from 'components/DeployAgent'
import SelectRepository from 'components/SelectRepository'
import StarUs from 'components/StarUs'
import Steps from 'components/Steps'
import { serverCreds } from 'db/credentials'
import { useGitHubClient } from 'hooks/useGitHubClient'
import useListenOnMessage from 'hooks/useListenOnMessage'
import { useLocalStorage } from 'hooks/useLocalStorage'
import { useRepositories } from 'hooks/useRepositories'
import { useRouter } from 'next/navigation'
import { GitHubAccount } from 'utils/github'
import { RepoSetup } from 'utils/repoSetup'
import { smolDeveloperTemplateID } from 'utils/smolTemplates'

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
  templateID: typeof smolDeveloperTemplateID
  openAIKey?: string
  openAIModel: string
}

const steps = [
  { name: 'Select Repository' },
  { name: 'Your Instructions' },
  { name: 'OpenAI API Key' },
  { name: 'Overview & Deploy' },
]

const openAIModels = [
  { displayName: 'GPT-4', value: 'gpt-4' },
  { displayName: 'GPT-4 32k', value: 'gpt-4-32k' },
  { displayName: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { displayName: 'GPT-3.5 Turbo 16k', value: 'gpt-3.5-turbo-16k' },
]

export const generateStaticParams: GetServerSideProps = async (ctx) => {
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
  projectID: string
  projectSlug: string
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

function Setup() {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>('gh_access_token', undefined)
  const github = useGitHubClient(accessToken)
  const [githubAccounts, setGitHubAccounts] = useState<GitHubAccount[]>([])
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [selectedRepository, setSelectedRepository] = useState<RepoSetup>()
  const { repos, refetch } = useRepositories(github)
  const [instructions, setInstructions] = useState('')
  const posthog = usePostHog()
  const router = useRouter()
  const [isDeploying, setIsDeploying] = useState(false)
  const [selectedOpenAIKeyType, setSelectedOpenAIKeyType] = useState<'e2b' | 'user'>('e2b')
  const [userOpenAIKey, setUserOpenAIKey] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState(openAIModels[0])

  const handleMessageEvent = useCallback((event: MessageEvent) => {
    if (event.data.accessToken) {
      setAccessToken(event.data.accessToken)
    } else if (event.data.installationID) {
      refetch()
    }
  }, [refetch, setAccessToken])
  useListenOnMessage(handleMessageEvent)

  const handleSelectOpenAIModel = useCallback((value: string) => {
    const model = openAIModels.find((model) => model.value === value)
    if (!model) throw new Error(`Invalid OpenAI model: ${value}`)
    setSelectedOpenAIModel(model)
  }, [])

  const handleOpenAIKeyChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUserOpenAIKey(event.target.value)
  }, [])

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
    setErrorMessage('')
    try {
      setIsDeploying(true)
      const response = await createAgent({
        defaultBranch: selectedRepository.defaultBranch,
        installationID: selectedRepository.installationID,
        owner: selectedRepository.owner,
        repo: selectedRepository.repo,
        repositoryID: selectedRepository.repositoryID,
        title: 'Smol PR',
        branch: `pr/smol-dev/${nanoid(6).toLowerCase()}`,
        body: instructions,
        commitMessage: 'Initial commit',
        templateID: smolDeveloperTemplateID,
        openAIKey: userOpenAIKey,
        openAIModel: selectedOpenAIModel.value,
      })

      posthog?.capture('clicked on deploy agent', {
        repository: `${selectedRepository.owner}/${selectedRepository.repo}`,
        instructions,
        hasUserProvidedOpenAIKey: !!userOpenAIKey,
      })

      // Redirect to the dashboard.
      if (response) {
        if ((response as any).statusCode === 500) {
          console.log('Error response', response)
          setErrorMessage((response as any).message)
          setIsDeploying(false)
          return
        }

        // router.push({
        //   pathname: '/logs/[slug]',
        //   query: {
        //     slug: `${response.projectSlug}-run-0`,
        //   },
        // })
      } else {
        console.error('No response from agent creation')
      }
    } catch (error: any) {
      setIsDeploying(false)
    }
  }

  function nextStep() {
    setCurrentStepIdx(currentStepIdx + 1)
  }

  function previousStep() {
    setCurrentStepIdx(currentStepIdx - 1)
    posthog?.capture('clicked previous step', {
      step: currentStepIdx - 1,
    })
  }

  function handleRepoSelection(repo: any) {
    setSelectedRepository(repo)
    nextStep()
  }

  async function signOut() {
    await supabaseClient.auth.signOut()
    posthog?.reset(true)
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
    <div className="h-full flex flex-col items-center justify-start bg-gray-800 py-8 px-6 space-y-8">
      <div className="mb-4 w-full flex items-center justify-between">
        <button
          className="text-sm font-semibold text-gray-400 hover:text-white transition-all"
          onClick={signOut}
        >
          Sign out
        </button>
        <StarUs />
      </div>
      <div className="overflow-hidden flex-1 mx-auto w-full max-w-lg flex flex-col">
        <Steps
          currentIdx={currentStepIdx}
          steps={steps}
        />
        <div className="h-px bg-gray-700 my-8" />
        {currentStepIdx === 0 && (
          <SelectRepository
            repos={repos}
            onRepoSelection={handleRepoSelection}
            accessToken={accessToken}
            githubAccounts={githubAccounts}
          />
        )}
        {currentStepIdx === 1 && (
          <AgentInstructions
            value={instructions}
            onTemplateSelect={t => { console.log(t); setInstructions(t) }}
            onChange={setInstructions}
            onBack={previousStep}
            onNext={nextStep}
          />
        )}
        {currentStepIdx === 2 && (
          <ChooseOpenAIKey
            selectedOpenAIKeyType={selectedOpenAIKeyType}

            onSelectedOpenAIKeyTypeChange={setSelectedOpenAIKeyType}
            userOpenAIKey={userOpenAIKey}
            onUserOpenAIKeyChange={handleOpenAIKeyChange}

            openAIModels={openAIModels}
            selectedOpenAIModel={selectedOpenAIModel}
            onOpenAIModelChange={handleSelectOpenAIModel}

            onNext={nextStep}
            onBack={previousStep}
          />
        )}
        {currentStepIdx === 3 && (
          <DeployAgent
            selectedRepo={selectedRepository!}
            instructions={instructions}
            onInstructionsChange={setInstructions}
            onChangeRepo={() => {
              setCurrentStepIdx(0)
              posthog?.capture('returned to repository selection step')
            }}
            error={errorMessage}
            onChangeTemplate={() => {
              setCurrentStepIdx(1)
              posthog?.capture('returned to the instructions step')
            }}
            onBack={previousStep}
            onDeploy={deployAgent}
            isDeploying={isDeploying}
            selectedOpenAIKeyType={selectedOpenAIKeyType}
          />
        )}
      </div>
    </div>
  )
}

export default Setup
