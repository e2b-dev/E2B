'use client'

import { Fragment, useRef, useState } from 'react'
import { useOnClickOutside } from 'usehooks-ts'
import { Send } from 'lucide-react'

import Textarea from '@/components/Textarea'
import SpinnerIcon from '@/components/Spinner'
import { usePostHog } from 'posthog-js/react'
import { DialogAnimated } from '@/components/DialogAnimated'
import { Button } from '@/components/Button'
import { usePathname } from 'next/navigation'

function FeedbackModal({ open, setOpen, onSend }) {
  const pathname = usePathname()
  const [feedback, setFeedback] = useState('')
  const [isSavingFeedback, setIsSavingFeedback] = useState(false)
  const posthog = usePostHog()
  const ref = useRef(null)

  useOnClickOutside(
    ref,
    () => {
      setOpen(false)
    },
    'mousedown',
  )

  async function saveFeedback(ev) {
    ev.preventDefault()
    // if (!user?.id) return console.error('User is not logged in') // for now, allow feedback from anonymous users
    if (!feedback) return console.error('Feedback is empty')
    if (isSavingFeedback) return console.error('Feedback is already being saved')

    setIsSavingFeedback(true)

    // https://app.posthog.com/data-management/actions/49309
    posthog?.capture('survey sent', {
      $survey_id: '018a1df8-ae8d-0000-8925-9a76a5255a29',
      $survey_name: 'Docs Feedback',
      $survey_response: `\`${pathname}\`\n${feedback ?? 'No feedback provided'}`,
    })

    // Cleanup
    setIsSavingFeedback(false)
    setOpen(false)
    setFeedback('')
    onSend?.()
  }

  return (
    <DialogAnimated
      open={open}
      setOpen={setOpen}
      as={Fragment}
    >
      <form
        ref={ref}
        autoCapitalize="off"
        autoCorrect="on"
        autoComplete="off"
        className="
        flex flex-col space-y-3
        p-4
      "
        onSubmit={saveFeedback}
      >
        <Textarea
          value={feedback}
          placeholder="What should we improve?"
          onChange={e => setFeedback(e.target.value)}
          // @ts-ignore
          open={open}
        />
        {/* @ts-ignore */}
        <Button
          onClick={saveFeedback}
          type="submit"
          disabled={isSavingFeedback || feedback.trim() === ''}
          className="flex cursor-pointer items-center gap-2"
        >
          {isSavingFeedback ? (
            // @ts-ignore
            <SpinnerIcon/>
          ) : (
            <Send size="14px"/>
          )}

          <span className="text-base">Send</span>
        </Button>
      </form>
    </DialogAnimated>
  )
}

export default FeedbackModal
