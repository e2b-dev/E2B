import {
  Github,
} from 'lucide-react'

import { Repos, RepoSetup } from 'utils/repoSetup'

export interface Props {
  repos: Repos
  onRepoSelection: (repo: RepoSetup) => void
}

function RepositoriesList({
  repos,
  onRepoSelection,
}: Props) {
  return (
    <ul role="list" className="w-full overflow-auto divide-y divide-gray-700">
      {repos?.map((r) => (
        <li key={r.id} className="px-2 flex items-center justify-between h-[60px]">
          <div className="flex flex-col items-start justify-start">
            <div className="flex items-center space-x-1">
              <Github color="#fff" size={14} />
              <p className="text-xs leading-6 text-white">{r.owner.login}</p>
              <p className="text-xs text-white">/</p>
              <p className="text-sm font-semibold leading-6 text-white">{r.name}</p>
            </div>
            {r.language && (
              <p className="text-xs leading-6 text-gray-400">{r.language}</p>
            )}
          </div>
          <button
            type="button"
            className="agent-btn-inline"
            onClick={() => onRepoSelection({
              installationID: r.installation_id,
              defaultBranch: r.default_branch,
              fullName: r.full_name,
              owner: r.owner.login,
              repo: r.name,
              repositoryID: r.id,
              url: r.url,
            })}
          >
            Select
          </button>
        </li>
      ))}
    </ul>
  )
}

export default RepositoriesList
