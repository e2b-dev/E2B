import {
  Check,
} from 'lucide-react'

export interface Props {
  repos: {
    id: number
    owner: string
    name: string
    language?: string
  }[]
  selectedRepositoryID?: number
  onRepoSelection: (repoID: number) => void
}

function RepositoriesList({
  repos,
  selectedRepositoryID,
  onRepoSelection,
}: Props) {
  return (
    <ul role="list" className="w-full overflow-auto divide-y divide-gray-700">
      {repos.map((r) => (
        <li key={r.id} className="px-2 flex items-center justify-between py-5 h-[70px]">
          <div className="flex flex-col items-start justify-start">
            <div className="flex items-center space-x-1">
              <p className="text-xs leading-6 text-white">{r.owner}</p>
              <p className="text-xs text-white">/</p>
              <p className="text-sm font-semibold leading-6 text-white">{r.name}</p>
            </div>
            <p className="text-xs leading-6 text-gray-400">{r.language}</p>
          </div>
          {r.id === selectedRepositoryID ? (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-400">Selected</span>
              <Check size={16} className="text-green-300" />
            </div>
          ) : (
            <button
              type="button"
              className="rounded bg-white/10 px-2 py-1 text-sm font-semibold text-white shadow-sm hover:bg-white/20"
              onClick={() => onRepoSelection(r.id)}
            >
              Select
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export default RepositoriesList