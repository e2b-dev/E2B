import {
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
import clsx from 'clsx'

import {
  DirProps,
  NodeType,
} from '../../filesystem'

function Dir({
  name,
  path,
  onSelect,
  metadata,
  children,
  fs,
  isExpanded,
  isSelected,
}: DirProps) {
  function handleOnClick(e: any) {
    fs.setIsDirExpanded(path, !isExpanded)

    // This conditions prevents deselecting when user clicks on a dir that's already selected.
    if (path !== fs.selectedPath) {
      fs.setIsNodeSelected(path, !isSelected)
    }

    onSelect?.(e,
      {
        type: NodeType.Dir,
        path,
        name,
        metadata,
        isSelected,
        isExpanded,
      })
  }

  const icon = isExpanded ? (
    <ChevronDownIcon
      className="text-white/60"
      size={16}
    />
  ) : (
    <ChevronRightIcon
      className="text-white/60"
      size={16}
    />
  )

  return (
    <div className="flex flex-col rounded">
      <div
        className={clsx(
          'px-1',
          'flex',
          'items-center',
          'rounded',
          'space-x-1',
          'cursor-pointer',
          'hover:bg-gray-700/80',
          'text-gray-300',
          { 'bg-gray-700': isSelected },
          { 'bg-transparent': !isSelected },
        )}
        onClick={handleOnClick}
      >
        {icon}
        <span className="truncate text-gray-400">{name}</span>
      </div>

      {isExpanded && (
        <div
          className="
            flex
            flex-col
            space-y-2
            lg:space-y-1
            mt-1
            ml-[11px]
            pl-3
            border-l
            border-gray-700
          "
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default Dir
