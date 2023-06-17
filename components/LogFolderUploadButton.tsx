import {
  Upload,
} from 'lucide-react'

export interface Props {
  onClick: (e: any) => void
}

function LogFolderUploadButton({
  onClick,
}: Props) {
  return (
    <button
      className="p-2 rounded-md bg-[#6366F1] flex items-center space-x-2"
      onClick={onClick}
    >
      <Upload size={14} />
      <span className="text-sm font-medium">Upload log folder</span>
    </button>
  )
}

export default LogFolderUploadButton