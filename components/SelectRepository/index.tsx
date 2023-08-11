import {
  useState,
} from 'react'
import {
  ArrowRight,
} from 'lucide-react'
import {
  useUser,
} from '@supabase/auth-helpers-react'

import {
  configureGitHubApp,
  GitHubAccount,
} from 'utils/github'
import SpinnerIcon from 'components/Spinner'
import { usePostHog } from 'posthog-js/react'
import { RepoSetup, Repos } from 'utils/repoSetup'

import RepoSwitch from './RepoSwitch'
import ExistingRepositories from './ExistingRepositories'
import NewRepository from './NewRepository'

export interface Props {
  repos?: Repos
  accessToken?: string
  onRepoSelection: (repo: RepoSetup) => void
  githubAccounts: GitHubAccount[]
}

function SelectRepository({
  repos,
  accessToken,
  onRepoSelection,
  githubAccounts,
}: Props) {
  const [selected, setSelected] = useState<'existing' | 'new'>('new')
  const user = useUser()
  const posthog = usePostHog()

  function configure() {
    posthog?.capture('started github app configuration')
    configureGitHubApp()
  }

  function selectRepo(repo: RepoSetup) {
    if (selected === 'new') {
      posthog?.capture('created new repository', {
        repository: repo.fullName,
      })
    } else if (selected === 'existing') {
      posthog?.capture('selected existing repository', {
        repository: repo.fullName,
      })
    }

    onRepoSelection(repo)
  }

  return (
    <div className="agent-step-root">
      <h2 className="agent-step-title">
        GitHub Repository
      </h2>
      <p className="agent-step-subtitle">
        Select a repository you want the AI agent to interact with.
      </p>

      {!user && (
        <div className="
          flex
          justify-center
        ">
          <SpinnerIcon className="text-slate-400" />
        </div>
      )}

      {user && (
        <>
          <RepoSwitch
            value={selected}
            onChange={v => {
              setSelected(v)
              posthog?.capture(`selected ${v} repository tab`)
            }}
          />
          {selected === 'existing' && (
            <ExistingRepositories
              accessToken={accessToken}
              repos={repos}
              onConfigureGitHubAppClick={configure}
              onRepoSelection={selectRepo}
            />
          )}
          {selected === 'new' && (
            <NewRepository
              accounts={githubAccounts}
              accessToken={accessToken}
              onConfigureGitHubAppClick={configure}
              onRepoSelection={selectRepo}
            />
          )}

          <button
            type="button"
            className="flex justify-start items-center text-xs font-medium space-x-1 text-gray-400 hover:text-white transition-all mt-4 rounded-md"
            onClick={configure}
          >
            <span>Configure GitHub Permissions</span>
            <ArrowRight size={14} />
          </button>
        </>
      )}
    </div>
  )
}

export default SelectRepository
