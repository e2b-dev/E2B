import {
  Database as DatabaseIcon,
  File as FileIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import clsx from 'clsx'
import path from 'path-browserify'

import {
  FileProps,
  NodeType,
} from '../../filesystem'

function File({
  name,
  path: filePath,
  onSelect,
  isSelected,
  metadata,
  fs,
}: FileProps) {
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
    <div
      className={clsx(
        'px-1',
        'rounded',
        'cursor-pointer',
        'text-gray-300',
        'flex',
        'items-center',
        'space-x-1',
        'hover:bg-gray-700/80',
        { 'bg-gray-700': isSelected },
        { 'bg-transparent': !isSelected }
      )}
      onClick={handleOnClick}
    >
      {icon}
      <span
        className='truncate text-gray-400'
      >
        {name}
      </span>
    </div>
  )
}

export default File
