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
    <>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Deploy <a className="text-indigo-400 hover:text-indigo-500 transition-all" href="https://github.com/smol-ai/developer" target="_blank" rel="noreferrer noopener">Smol Developer</a>
      </h2>
      <p className="mt-2 mb-6 text-lg leading-8 text-gray-400">
        Select a git repository to which you want to give the AI agent access.
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
    </>
  )
}

export default SelectRepository
