import RepoOwnerSelect from './RepoOwnerSelect'
import RepoNameInput from './RepoNameInput'

export interface Props {
  org?: string
  name: string
}

function NewRepository({
  org,
  name,
}: Props) {
  return (
    <div className="flex-1 flex flex-col space-y-4 items-center justify-start rounded-md">
      <RepoOwnerSelect
        owners={['mlejva', 'e2b-dev']}
      />
      <RepoNameInput />

      <button
        className="rounded bg-white/10 px-2 py-1 text-sm text-white font-medium hover:bg-white/20"
      >Create</button>
    </div>
  )
}

export default NewRepository
