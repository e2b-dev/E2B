'use client'

import { useState } from 'react'

import FeedbackButton from './FeedbackButton'
import FeedbackModal from './FeedbackModal'
import useExpiringState from '@/utils/useExpiringState'

export function Feedback({
                           className,
                           variant,
                         }: {
  className?: string
  variant?: string
}) {
  const [open, setOpen] = useState(false)
  const [isFinished, setIsFinished] = useExpiringState({
    defaultValue: false,
    timeout: 4000,
  })

  return (
    <>
      <FeedbackButton
        className={className}
        variant={variant}
        onClick={e => {
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
    </>
  )
}
