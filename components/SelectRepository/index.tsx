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

import { RepoSetup, Repos } from './RepoSetup'
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

  return (
    <>
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Select Git Repository
      </h2>
      <p className="mt-2 mb-6 text-lg leading-8 text-gray-400">
        Select a git repository to which you want to give the AI developer access.
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
            onChange={setSelected}
          />
          {selected === 'existing' && (
            <ExistingRepositories
              accessToken={accessToken}
              repos={repos}
              onConfigureGitHubAppClick={configureGitHubApp}
              onRepoSelection={onRepoSelection}
            />
          )}
          {selected === 'new' && (
            <NewRepository
              accounts={githubAccounts}
              accessToken={accessToken}
              onConfigureGitHubAppClick={configureGitHubApp}
              onRepoSelection={onRepoSelection}
            />
          )}
          <button
            type="button"
            className="flex justify-start items-center text-xs font-medium space-x-1 text-white/80 hover:text-white transition-all mt-4 rounded-md"
            onClick={configureGitHubApp}
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
