import {
  Github,
} from 'lucide-react'

import SpinnerIcon from 'components/Spinner'
import RepositoriesList from './RepositoriesList'

export interface Props {
  hasAccessToken: boolean
  repos?: any[]
  onConfigureGitHubAppClick: () => void
  onRepoSelection: (repoID: number) => void
}

function ExistingRepositories({
  hasAccessToken,
  repos,
  onConfigureGitHubAppClick,
  onRepoSelection,
}: Props) {

  return (
    <div className="overflow-hidden flex-1 flex flex-col items-center justify-center border border-gray-700 rounded-md">
      {!hasAccessToken && (
        <button
          type="button"
          className="flex items-center space-x-2 rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all"
          onClick={onConfigureGitHubAppClick}
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
                onClick={onConfigureGitHubAppClick}
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
              onRepoSelection={onRepoSelection}
            />
          )}
        </>
      )}
    </div>
  )
}

export default ExistingRepositories