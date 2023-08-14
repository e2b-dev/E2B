export interface Props {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function RepoNameInput({
  value,
  onChange,
}: Props) {

  return (
    <div className="w-full">
      <label className="text-sm font-medium leading-6 text-gray-400">
        Repository Name
      </label>
      <div className="mt-2">
        <input
          className="bg-gray-800 block w-full rounded-md border-0 px-3 py-1.5 text-gray-100 shadow-sm ring-1 ring-inset ring-gray-400 placeholder:text-gray-400 focus:ring-gray-300 outline-none sm:text-sm sm:leading-6 transition-all"
          placeholder="new-repo-name"
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

export default RepoNameInput