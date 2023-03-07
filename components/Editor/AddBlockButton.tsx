import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { nanoid } from 'nanoid'

import { Block } from 'state/store'

export interface Props {
  addBlock: (block: Block) => void
}

function AddBlockButton({ addBlock }: Props) {
  return (
    <button
      onMouseDown={() => addBlock({
        prompt: '',
        id: nanoid(),
      })}
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
