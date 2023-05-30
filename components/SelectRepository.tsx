import {
  Github,
} from 'lucide-react'
import {
  useUser,
} from '@supabase/auth-helpers-react'

import { configureGitHubApp } from 'utils/github'
import RepositoriesList from 'components/RepositoriesList'
import SpinnerIcon from 'components/Spinner'

export interface Props {
  repos?: any[]
  hasAccessToken: boolean
  selectedRepositoryID?: number
  onRepoSelection: (repoID: number) => void
}

function SelectRepository({
  repos,
  hasAccessToken,
  selectedRepositoryID,
  onRepoSelection,
}: Props) {
  const user = useUser()
  const ghUsername: string = user?.user_metadata['user_name'] || ''

  return (
    <>
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
          <div className="overflow-hidden flex-1 flex flex-col items-center justify-center border border-gray-700 rounded-md">
            {!hasAccessToken && (
              <button
                type="button"
                className="flex items-center space-x-2 rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all"
                onClick={configureGitHubApp}
              >
                <Github size={16} />
                <span>Configure GitHub Permissions</span>
              </button>
            )}

            {hasAccessToken && (
              <>
                {!repos && (
                  <div className="flex justify-center">
                    <SpinnerIcon className="text-slate-400" />
                  </div>
                )}
                {repos && repos.length === 0 && (
                  <>
                    <span className="mb-2 text-sm text-gray-400 font-semibold">
                      No connected repositories found
                    </span>
                    <button
                      type="button"
                      className="flex items-center space-x-2 rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all"
                      onClick={configureGitHubApp}
                    >
                      <Github size={16} />
                      <span>Configure GitHub Permissions</span>
                    </button>
                  </>
                )}
                {repos && repos.length > 0 && (
                  <RepositoriesList
                    repos={repos.sort((a, b) => (new Date(b.updated_at) as any) - (new Date(a.updated_at) as any)).map(r => ({
                      id: r.id,
                      owner: r.owner.login,
                      name: r.name,
                      language: r.language,
                    }))}
                    selectedRepositoryID={selectedRepositoryID}
                    onRepoSelection={onRepoSelection}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

export default SelectRepository
