import clsx from 'clsx'
import { Plus } from 'lucide-react'

export interface Props {
  addBlock: () => void
}

function AddBlockButton({ addBlock }: Props) {
  return (
    <button
      onMouseDown={addBlock}
      type="submit"
      className={clsx(
        'items-center',
        'justify-center',
        'transition-all',
        'rounded-full',
        'bg-green-800/60',
        'hover:bg-green-800',
        'text-white',
        'py-1.5',
        'px-1.5',
      )}
    >
      <Plus size="18px" />
    </button>
  )
}

export default AddBlockButton
