import useExpiringState from 'hooks/useExpiringState'
import { useState } from 'react'

import FeedbackButton from './FeedbackButton'
import FeedbackModal from './FeedbackModal'

function Feedback() {
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false)
  const [isFinished, setIsFinished] = useExpiringState({ defaultValue: false, timeout: 4000 })

  return (
    <div className="flex flex-col items-end flex-1">
      <FeedbackButton
        isOpen={isFeedbackVisible || isFinished}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsFeedbackVisible(f => !f)
        }}
        isFinished={isFinished}
      />
      <FeedbackModal
        onSend={() => setIsFinished(true)}
        isOpen={isFeedbackVisible}
        onClose={() => setIsFeedbackVisible(false)}
      />
    </div>
  )
}

export default Feedback
