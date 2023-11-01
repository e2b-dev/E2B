'use client'

import { Check, MessageCircle } from 'lucide-react'
import { Button } from '@/components/Button'

// export interface Props {
//   onClick: (e: MouseEvent<HTMLButtonElement>) => void
//   isFinished: boolean
// }

function FeedbackButton({ onClick, isFinished, variant, className }) {
  return (
    // @ts-ignore
    <Button
      onMouseDown={onClick}
      variant={variant}
      className={className}
    >
      {isFinished ? (
        <>
          <Check size={14}/>
          <span className="text-sm">Thank you!</span>
        </>
      ) : (
        <div className="flex flex-row items-center gap-2">
          <MessageCircle size={14}/>
          <span className="text-sm">Send feedback to CEO</span>
        </div>
      )}
    </Button>
  )
}

export default FeedbackButton
