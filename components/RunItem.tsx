import clsx from 'clsx'
import Link from 'next/link'
import { usePostHog } from 'posthog-js/react'
import {
  FileProps,
} from '../filesystem'

function RunItem({
  name,
  path: filePath,
  onSelect,
  isSelected,
  metadata,
}: FileProps) {
  const posthog = usePostHog()
  return (
    <Link
      href={metadata['href']}
      className={
        clsx(
          'px-2',
          'py-2',
          'rounded-md',
          'cursor-pointer',
          'flex',
          'transition-all',
          'items-center',
          'space-x-2',
          'bg-[#1F2437]',
          'border',
          'border-[#2A3441]',
          'hover:bg-[#262C40]',
          'w-full',
          'justify-between',
        )}
      onClick={() => {
        posthog?.capture('selected run', {
          slug: metadata['id'],
        })
      }}
    >
      <span className="flex space-x-2 truncate">
        <span
          className="
        text-sm
        whitespace-nowrap
        text-gray-200
        "
        >
          Run
        </span >
        <span
          className="
        text-sm
        truncate
        whitespace-nowrap
        text-gray-500
        "
        >
          {metadata['id']}
        </span>
      </span>
      <span
        className="
        text-sm
        whitespace-nowrap
        text-gray-500
        truncate
        "
      >
        {metadata['timestamp'].toLocaleString()}
      </span>
    </Link>
  )
}

export default RunItem
