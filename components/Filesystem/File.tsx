import {
  File as FileIcon,
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

import {
  FileProps,
  NodeType,
} from '../../filesystem'
import { useRouter } from 'next/router'

function File({
  name,
  path: filePath,
  onSelect,
  isSelected,
  metadata,
  fs,
}: FileProps) {
  const router = useRouter()
  const isSelectedViaRouter = router.query.logFileID === metadata['href']['query']['logFileID']

  function handleOnClick(e: any) {
    // This conditions prevents deselecting when user clicks on a file that's already selected.
    if (filePath !== fs.selectedPath) {
      fs.setIsNodeSelected(filePath, !isSelected)
    }
    onSelect?.(e,
      {
        type: NodeType.File,
        path: filePath,
        name,
        metadata,
        isSelected,
        isExpanded: false,
      })
  }

  return (
    <Link
      prefetch={false}
      href={metadata['href']}
      className={
        clsx(
          'px-1',
          'py-2',
          'rounded-md',
          'cursor-pointer',
          'flex',
          'items-center',
          'space-x-1',
          'hover:bg-[#1F2437]',
          'w-full',
          { 'bg-[#1F2437]': isSelectedViaRouter },
          { 'bg-transparent': !isSelectedViaRouter }
        )}
      onClick={handleOnClick}
      replace
      shallow
    >
      <FileIcon
        className="shrink-0"
        size={16}
      />
      <span
        className="
        text-sm
        whitespace-nowrap
        text-gray-200
        "
      >
        {name}
      </span >
    </Link >
  )
}

export default File
