import { useUser } from '@supabase/auth-helpers-react'
import { FormEvent, MouseEvent, useRef, useState } from 'react'
import { useOnClickOutside } from 'usehooks-ts'

import Textarea from 'components/Textarea'
import SpinnerIcon from 'components/Spinner'
import { useAddFeedback } from 'hooks/useAddFeedback'
import clsx from 'clsx'

export interface Props {
  isOpen: boolean
  onClose: () => any
}

function FeedbackModal({ isOpen, onClose }: Props) {
  const [feedback, setFeedback] = useState('')
  const [isSavingFeedback, setIsSavingFeedback] = useState(false)
  const user = useUser()
  const ref = useRef<HTMLFormElement>(null)

  useOnClickOutside(ref, onClose, 'mousedown')

  const addFeedback = useAddFeedback()

  async function saveFeedback(
    e: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement, globalThis.MouseEvent>,
  ) {
    e.preventDefault()
    if (!user?.id) return
    if (!feedback) return
    if (isSavingFeedback) return

    setIsSavingFeedback(true)

    await addFeedback(feedback)

    setIsSavingFeedback(false)
    onClose()
  }

  return (
    <div className="relative flex flex-row-reverse pt-1">
      {isOpen &&
        <form
          ref={ref}
          autoComplete="of"
          className="
          flex
          p-3
          border
          z-50
          bg-gray-900
          border-gray-600
          w-[400px]
          rounded
          absolute
          flex-col
          items-end
          font-sans
          space-y-3
          "
          onSubmit={saveFeedback}
        >
          <Textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            isOpen={isOpen}
          />
          <button
            className={clsx({ 'border-white/10 text-gray-100': isOpen, 'border-white/5 text-gray-400': !isOpen }, 'group ml-auto flex items-center space-x-1 cursor-pointer py-1 px-2 rounded-md bg-gray-900 border border-white/5 hover:border-white/10 transition-all')}
            onMouseDown={saveFeedback}
            disabled={isSavingFeedback || feedback.trim() === ''}
          >
            {isSavingFeedback ? <SpinnerIcon className="text-white" /> : null}
            {!isSavingFeedback && <span className="text-sm">Send</span>}
          </button>
        </form>
      }
    </div>
  )
}

export default FeedbackModal
