import clsx from 'clsx'

import ConfigureGitHubButton from 'components/ConfigureGitHubButton'
import SpinnerIcon from 'components/Spinner'
import { RepoSetup, Repos } from 'utils/repoSetup'

import RepositoriesList from './RepositoriesList'

export interface Props {
  accessToken?: string
  repos?: Repos
  onConfigureGitHubAppClick: (e: any) => void
  onRepoSelection: (repo: RepoSetup) => void
}

function ExistingRepositories({
  accessToken,
  repos,
  onConfigureGitHubAppClick,
  onRepoSelection,
}: Props) {

  return (
    <div className={clsx(
      repos && repos.length > 0 ? 'justify-start' : 'justify-center',
      'overflow-hidden flex-1 flex flex-col items-center border border-gray-700 rounded-md'
    )}>
      {!accessToken && (
        <ConfigureGitHubButton
          onClick={onConfigureGitHubAppClick}
        />
      )}

      {accessToken && (
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
              <ConfigureGitHubButton
                onClick={onConfigureGitHubAppClick}
              />
            </>
          )}
          {repos && repos.length > 0 && (
            <RepositoriesList
              repos={repos.sort((a, b) => (new Date(b.updated_at || b.created_at!) as any) - (new Date(a.updated_at || b.created_at!) as any))}
              onRepoSelection={onRepoSelection}
            />
          )}
        </>
      )}
    </div>
  )
}

export default ExistingRepositories