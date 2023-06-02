import {
  useEffect,
  useState,
} from 'react'
import {
  ArrowRight,
} from 'lucide-react'
import {
  useUser,
} from '@supabase/auth-helpers-react'

import { configureGitHubApp } from 'utils/github'
import SpinnerIcon from 'components/Spinner'
import { useGitHubClient } from 'hooks/useGitHubClient'

import RepoSwitch from './RepoSwitch'
import ExistingRepositories from './ExistingRepositories'
import NewRepository from './NewRepository'
import { GitHubAccount } from './NewRepository/RepoAccountSelect'

export interface Props {
  repos?: any[]
  accessToken?: string
  selectedRepositoryID?: number
  onRepoSelection: (repoID: number) => void
}

function SelectRepository({
  repos,
  accessToken,
  selectedRepositoryID,
  onRepoSelection,
}: Props) {
  const user = useUser()
  const [selected, setSelected] = useState<'existing' | 'new'>('new')
  const ghClient = useGitHubClient(accessToken)
  const [githubAccounts, setGitHubAccounts] = useState<GitHubAccount[]>([])

  useEffect(function getGitHubAccounts() {
    async function getAccounts() {
      if (!ghClient) return
      const installations = await ghClient?.apps.listInstallationsForAuthenticatedUser()
      const accounts: GitHubAccount[] = []
      installations.data.installations.forEach(i => {
        if (i.account) {
          const ghAccType = (i.account as any)['type']
          const ghLogin = (i.account as any)['login']
          // Filter out user accounts that are not the current user (when a user has access to repos that aren't theirs)
          if (ghAccType === 'User' && ghLogin !== user?.user_metadata?.user_name) return
          accounts.push({ name: ghLogin, isOrg: ghAccType === 'Organization' })
        }
      })
      setGitHubAccounts(accounts)
    }
    getAccounts()
  }, [ghClient, user])

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
              // onRepoSelection={onRepoSelection}
              accessToken={accessToken}
              onConfigureGitHubAppClick={configureGitHubApp}
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
