import {
  MessageCircle,
} from 'lucide-react'

export interface Props {
  onClick: (e: any) => void
}

function FeedbackButton({
  onClick,
}: Props) {
  return (
    <button
      className="group ml-auto flex items-center space-x-1 cursor-pointer transition-all py-1 px-2 rounded-md bg-gray-900 border border-white/5 hover:border-white/10"
      onClick={onClick}
    >
      <MessageCircle size={14} className="text-gray-400 group-hover:text-gray-100 transition-all" />
      <span className="text-sm text-gray-400 group-hover:text-gray-100 transition-all">Send feedback to CEO</span>
    </button>
  )
}

export default FeedbackButton