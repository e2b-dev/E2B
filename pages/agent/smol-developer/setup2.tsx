import {
  useState,
  useCallback,
} from 'react'
import useSWRMutation from 'swr/mutation'
import type { GetServerSideProps } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'

import Steps from 'components/Steps'
import SelectRepository from 'components/SelectRepository'
import { serverCreds } from 'db/credentials'
import { useGitHubClient } from 'hooks/useGitHubClient'
import { useRepositories } from 'hooks/useRepositories'
import { useLocalStorage } from 'hooks/useLocalStorage'
import useListenOnMessage from 'hooks/useListenOnMessage'

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
}

// export interface Repository {
//   repositoryID: number
//   installationID: number
//   fullName: string
//   branches?: string[]
//   defaultBranch: string
//   url: string
//   owner: string
//   name: string
// }

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

async function handlePostAgent(url: string, { arg }: { arg: PostAgentBody }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

function Setup() {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedRepositoryID, setSelectedRepositoryID] = useState<number>()
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

  function handleRepoSelection(repoID: number) {
    setSelectedRepositoryID(repoID)
    setCurrentStep(val => {
      const newVal = val + 1
      steps[val].status = 'complete'
      steps[newVal].status = 'current'
      return newVal
    })
  }

  return (
    <div className="h-full flex flex-col items-center justify-start bg-gray-800 py-8 px-6">
      <div className="overflow-hidden flex-1 mx-auto w-full max-w-lg flex flex-col">
        <Steps steps={steps} />
        <div className="h-px bg-gray-700 my-8" />

        {currentStep === 0 ? (
          <SelectRepository
            repos={repos}
            selectedRepositoryID={selectedRepositoryID}
            onRepoSelection={handleRepoSelection}
            hasAccessToken={!!accessToken}
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
