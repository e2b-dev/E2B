import {
  Database as DatabaseIcon,
  File as FileIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import clsx from 'clsx'
import path from 'path-browserify'
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


  let icon = (
    <FileIcon
      size={16}
    />
  )

  const ext = path.extname(filePath).substring(1)
  if (ext === 'sql') {
    icon = (
      <DatabaseIcon
        className="
          text-red-500
        "
        size={16}
      />
    )
  } else if (ext === 'toml') {
    icon = (
      <SettingsIcon
        className="
          text-teal-800
        "
        size={16}
      />
    )
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
          { 'bg-[#1F2437]': isSelectedViaRouter },
          { 'bg-transparent': !isSelectedViaRouter }
        )}
      onClick={handleOnClick}
      shallow
    >
      {icon}
      <span
        className="
        truncate
        text-sm
        whitespace-nowrap
        text-gray-100
        "
      >
        {name}
      </span >
    </Link >
  )
}

export default File
