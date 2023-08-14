import {
  Upload,
} from 'lucide-react'
import Spinner from './Spinner'

export interface Props {
  onClick: (e: any) => void
  isUploading: boolean
}

function LogFolderUploadButton({
  onClick,
  isUploading,
}: Props) {
  return (
    <button
      className="p-2 rounded-md bg-[#6366F1] flex items-center h-[36px]"
      onClick={onClick}
    >
      {isUploading &&
        <Spinner />
      }
      {!isUploading &&
        <div className="flex items-center space-x-2">
          <Upload size={14} />
          <span className="text-sm font-medium">Upload log folder</span>
        </div>}
    </button>
  )
}

export default LogFolderUploadButton