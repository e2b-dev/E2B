import { useUser } from '@supabase/auth-helpers-react'
import { FormEvent, MouseEvent, useRef, useState } from 'react'
import { useOnClickOutside } from 'usehooks-ts'
import { Send } from 'lucide-react'

import Textarea from 'components/Textarea'
import SpinnerIcon from 'components/Spinner'
import { useAddFeedback } from 'hooks/useAddFeedback'

export interface Props {
  isOpen: boolean
  onClose: () => any
  onSend?: () => void
}

function FeedbackModal({ isOpen, onClose, onSend }: Props) {
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
    setFeedback('')
    onSend?.()
  }

  return (
    <div className="relative flex flex-row-reverse">
      {isOpen &&
        <form
          ref={ref}
          autoCapitalize="off"
          autoCorrect="on"
          autoComplete="off"
          className="
          flex
          p-3
          mt-1
          border
          z-50
          bg-gray-900
          border-white/5
          w-[400px]
          shadow-lg
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
            placeholder="What should we improve?"
            onChange={e => setFeedback(e.target.value)}
            isOpen={isOpen}
          />
          <button
            className="flex items-center space-x-2 rounded-md bg-gray-200 py-1 px-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={saveFeedback}
            disabled={isSavingFeedback || feedback.trim() === ''}
          >
            {isSavingFeedback &&
              <SpinnerIcon />
            }

            {!isSavingFeedback &&
              <Send size="14px" />
            }
            <span className="text-sm">Send</span>
          </button>
        </form>
      }
    </div>
  )
}

export default FeedbackModal
