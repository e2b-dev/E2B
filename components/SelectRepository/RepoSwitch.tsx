import clsx from 'clsx'

export interface Props {
  value: 'existing' | 'new'
  onChange: (value: 'existing' | 'new') => void
}

const baseClasses = 'text-xs font-semibold p-2 rounded-md transition-all cursor-pointer'
const unselectedClasses = 'text-gray-500 hover:bg-indigo-400/10 hover:text-indigo-400'
const selectedClasses = 'bg-indigo-400/10 text-indigo-400'

function RepoSwitch({
  value,
  onChange,
}: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-center space-x-2">
        <div
          className={clsx(
            baseClasses,
            value === 'new' ? selectedClasses : unselectedClasses,
          )}
          onClick={() => onChange('new')}
        >
          Create New Repository
        </div>
        <div
          className={clsx(
            baseClasses,
            value === 'existing' ? selectedClasses : unselectedClasses,
          )}
          onClick={() => onChange('existing')}
        >
          Select Existing Repository
        </div>
      </div>
    </div>
  )
}

export default RepoSwitch
