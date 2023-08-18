import {
  Edit,
} from 'lucide-react'
import Spinner from 'components/Spinner'

import clsx from 'clsx'

export interface Props {
  isRenaming: boolean
  onClick: (e: any) => void
}


function RenameLogUploadButton({
  isRenaming,
  onClick,
}: Props) {
  return (
    <button
      className={clsx(
        'h-6 w-20 flex items-center justify-center space-x-1 px-1 bg-[#1F2437] transition-all rounded-md text-gray-200 text-xs',
        isRenaming && 'hover:bg-[#1F2437] cursor-not-allowed',
        !isRenaming && 'cursor-pointer hover:bg-[#272D44]',
      )}
      onClick={onClick}
    >
      {isRenaming ? (
        <Spinner
          className="text-gray-200 transition-all select-none"
        />
      ) : (
        <Edit
          className="text-gray-200 transition-all select-none"
          size={14}
        />
      )}
      <span>Rename</span>
    </button>
  )
}

export default RenameLogUploadButton