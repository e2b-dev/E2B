'use client'

import { useState } from 'react'

import FeedbackButton from './FeedbackButton'
import FeedbackModal from './FeedbackModal'
import useExpiringState from '@/utils/useExpiringState';

export function Feedback() {
  const [open, setOpen] = useState(false)
  const [isFinished, setIsFinished] = useExpiringState({ defaultValue: false, timeout: 4000 })

  return (
    <div className="flex flex-col items-end flex-1">
      <FeedbackButton
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(f => !f)
        }}
        isFinished={isFinished}
      />
      <FeedbackModal
        onSend={() => setIsFinished(true)}
        open={open}
        setOpen={setOpen}
      />
    </div>
  )
}

