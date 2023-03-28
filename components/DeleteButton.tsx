import clsx from 'clsx'
import { useState, useEffect, MouseEvent } from 'react'

import Text from './Text'

export interface Props {
  onDelete: () => void
}

function DeleteButton({ onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(
    function expireConfirm() {
      if (confirmDelete) {
        const cleanup = setTimeout(() => setConfirmDelete(false), 4000)
        return () => {
          clearTimeout(cleanup)
        }
      }
    },
    [confirmDelete],
  )

  function handleDelete(
    e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>,
  ) {
    e.stopPropagation()
    e.preventDefault()

    if (confirmDelete) {
      try {
        onDelete()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Error deleting item: ${msg}`)
      }
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <button
      className={clsx(
        `flex
            items-center
            justify-center
            transition-all
            rounded-lg
            border
            border-transparent
            px-3
            py-2
            `,
        {
          'border-red-600 hover:bg-red-600/10': confirmDelete,
        },
      )}
      onClick={handleDelete}
    >
      <Text
        size={Text.size.S3}
        text={confirmDelete ? 'Confirm' : 'Delete'}
        className={clsx('whitespace-nowrap hover:text-red-600 transition-all', {
          'text-red-600': confirmDelete,
          'text-slate-300': !confirmDelete,
        })}
      />
    </button>
  )
}

export default DeleteButton
