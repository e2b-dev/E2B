import clsx from 'clsx'
import Link from 'next/link'
import { MouseEvent, useEffect, useState } from 'react'

import SpinnerIcon from 'components/icons/Spinner'
import Text from 'components/Text'

export interface ItemSetup {
  id: string
  title: string
  created_at: Date
  icon?: React.ReactNode
  path: string
  type: string
}

export interface Props {
  item: ItemSetup
  deleteItem?: () => Promise<void>
}

function Item({ item, deleteItem }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  async function handleDelete(
    e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>,
  ) {
    if (!deleteItem) return

    e.stopPropagation()
    e.preventDefault()

    if (confirmDelete && !isDeleting) {
      setIsDeleting(true)
      try {
        await deleteItem()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Error deleting item: ${msg}`)
      } finally {
        setIsDeleting(false)
      }
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <Link
      className="group flex items-center justify-between space-x-4 rounded"
      href={{
        pathname: item.path,
        query: {
          id: item.id,
        },
      }}
    >
      <div className="flex items-center space-x-4 truncate">
        <div className="
          m-1
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-lg border
          border-slate-200
          group-hover:border-green-800
          text-slate-300
          transition-all
          group-hover:bg-green-400
          group-hover:text-green-800
          "
        >
          {item.icon}
        </div>
        <div
          className="flex flex-col"
        >
          <Text
            className="text-slate-600 transition-all group-hover:text-green-800"
            size={Text.size.S2}
            text={item.title}
          />
          <div className="flex space-x-1 text-slate-300 transition-all group-hover:text-slate-400">
            <Text
              size={Text.size.S3}
              text={item.type}
            />
            <Text
              size={Text.size.S3}
              text="-"
            />
            <Text
              size={Text.size.S3}
              text={item.created_at.toLocaleString()}
              suppressHydrationWarning
            />
          </div>
        </div>
      </div>
      {deleteItem &&
        <button
          className={clsx(
            'flex items-center justify-center rounded border border-transparent px-3 py-1.5',
            {
              'border-red-600 hover:bg-red-600/10': confirmDelete,
            },
          )}
          onClick={handleDelete}
        >
          {isDeleting && (
            <Text
              className="whitespace-nowrap text-red-600"
              icon={<SpinnerIcon className="text-red-600" />}
              size={Text.size.S3}
              text="Deleting..."
            />
          )}
          {!isDeleting && (
            <Text
              size={Text.size.S3}
              text={confirmDelete ? 'Confirm delete' : 'Delete'}
              className={clsx('whitespace-nowrap hover:text-red-600', {
                'text-red-600': confirmDelete,
                'text-slate-300': !confirmDelete,
              })}
            />
          )}
        </button>
      }
    </Link>
  )
}

export default Item