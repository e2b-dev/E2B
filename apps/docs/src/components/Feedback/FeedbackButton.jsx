"use client"

import {
  Check,
  MessageCircle,
} from 'lucide-react'

// export interface Props {
//   onClick: (e: MouseEvent<HTMLButtonElement>) => void
//   isFinished: boolean
// }

function FeedbackButton({
  onClick,
  isFinished,
}) {
  return (
    <button
      className="
        group w-full 
        flex items-center justify-center space-x-1
        cursor-pointer py-1 px-2 rounded-md bg-gray-800 border border-white/5
        hover:border-white/10 transition-all hover:text-white
      "
      onMouseDown={onClick}
    >
      {isFinished
        ? <>
          <Check size={14} className="" />
          <span className="text-sm">Thank you!</span>
        </>
        : <>
          <MessageCircle size={14} className="" />
          <span className="text-sm">Send feedback to CEO</span>
        </>
      }
    </button>
  )
}

export default FeedbackButton
