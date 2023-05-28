import {
  useState,
  useCallback,
} from 'react'
import {
  Github,
} from 'lucide-react'
import type { GetServerSideProps } from 'next'
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import {
  useUser,
  useSession,
} from '@supabase/auth-helpers-react'
import useSWRMutation from 'swr/mutation'

import { serverCreds } from 'db/credentials'
import { openPopupModal } from 'utils/popupModal'
import useListenOnMessage from 'hooks/useListenOnMessage'
import { useGitHubClient } from 'hooks/useGitHubClient'
import { useRepositories } from 'hooks/useRepositories'
import { RepoSetup } from 'components/Repos'
import RepositoriesList from 'components/RepositoriesList'
import { useLocalStorage } from 'hooks/useLocalStorage'
import SpinnerIcon from 'components/Spinner'
import Steps from 'components/Steps'

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

async function handlePostAgent(url: string, { arg }: { arg: PostAgentBody }) {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify(arg),

    headers: {
      'Content-Type': 'application/json',
    },
  }).then(r => r.json())
}

function Repo() {
  const [accessToken, setAccessToken] = useLocalStorage<string | undefined>('gh_access_token', undefined)
  const gitHub = useGitHubClient(accessToken)
  const { repos, refetch } = useRepositories(gitHub)
  const supabaseClient = useSupabaseClient()
  const user = useUser()
  const session = useSession()
  const sessionCtx = useSessionContext()
  const [selectedRepo, setSelectedRepo] = useState<RepoSetup>()


  const ghUsername: string = user?.user_metadata['user_name'] || ''

  const handleMessageEvent = useCallback((event: MessageEvent) => {
    if (event.data.accessToken) {
      setAccessToken(event.data.accessToken)
    } else if (event.data.installationID) {
      refetch()
    }
  }, [refetch, setAccessToken])
  useListenOnMessage(handleMessageEvent)

  function configureGitHubApp() {
    const url = new URL('https://github.com/apps/e2b-for-github/installations/new')
    openPopupModal(url)
  }

  const {
    trigger: createAgent,
  } = useSWRMutation('/api/agent', handlePostAgent)

  async function deployAgent() {
    if (!selectedRepo) return
    console.log('selectedRepo', selectedRepo)


    return
    await createAgent({
      defaultBranch: selectedRepo.defaultBranch,
      installationID: selectedRepo.installationID,
      owner: selectedRepo.owner,
      repo: selectedRepo.repo,
      repositoryID: selectedRepo.repositoryID,
      title,
      branch,
      body,
      commitMessage,
    })
  }


  return (
    <div className="h-full flex flex-col items-center justify-start bg-gray-800 py-8 px-6">
      <Steps />
      {/* Horizontal separator */}

      <div className="flex-1 mx-auto max-w-lg flex flex-col">
        <div className="h-px bg-gray-700 my-8" />
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Select Git Repository
        </h2>
        <p className="mt-2 mb-6 text-lg leading-8 text-gray-400">
          Select a git repository to which you want to give the AI developer access.
        </p>

        {!user && (
          <div
            className="
              flex
              justify-center
            "
          >
            <SpinnerIcon className="text-slate-400" />
          </div>
        )}

        {user && (
          <>
            {ghUsername && (
              <span className="mb-1 text-xs text-gray-400 font-semibold">
                {ghUsername}{ghUsername.endsWith('s') ? "'" : "'s"} repositories
              </span>
            )}
            <div className="flex-1 flex flex-col items-center justify-center border border-gray-700 rounded-md">
              {!accessToken && (
                <button
                  type="button"
                  className="flex items-center space-x-2 rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all"
                  onClick={configureGitHubApp}
                >
                  <Github size={16} />
                  <span>Configure GitHub Permissions</span>
                </button>
              )}

              {accessToken && (
                <>
                  <RepositoriesList />
                </>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default Repo
