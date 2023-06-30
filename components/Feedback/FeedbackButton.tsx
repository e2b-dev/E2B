import { MouseEvent } from 'react'
import {
  Check,
  MessageCircle,
} from 'lucide-react'
import clsx from 'clsx'

export interface Props {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  isOpen: boolean
  isFinished: boolean
}

function FeedbackButton({
  onClick,
  isOpen,
  isFinished,
}: Props) {
  return (
    <button
      className={clsx({ 'border-white/10 text-gray-100': isOpen, 'border-white/5 text-gray-400': !isOpen }, 'group ml-auto flex items-center space-x-1 cursor-pointer py-1 px-2 rounded-md bg-gray-900 border border-white/5 hover:border-white/10 transition-all hover:text-white')}
      onMouseDown={onClick}
    >
      {isFinished &&
        <>
          <Check size={14} className="" />
          <span className="text-sm">Thank you!</span>
        </>
      }
      {!isFinished &&
        <>
          <MessageCircle size={14} className="" />
          <span className="text-sm">Send feedback to CEO</span>
        </>
      }
    </button>
  )
}

export default FeedbackButton