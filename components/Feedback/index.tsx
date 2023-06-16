import { useState } from 'react'

import FeedbackButton from './FeedbackButton'
import FeedbackModal from './FeedbackModal'

function Feedback() {
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false)

  return (
    <div className="flex flex-col items-end flex-1">
      <div>
        <FeedbackButton
          isOpen={isFeedbackVisible}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsFeedbackVisible(f => !f)
          }}
        />
        <FeedbackModal
          isOpen={isFeedbackVisible}
          onClose={() => setIsFeedbackVisible(f => !f)}
        />
      </div>
    </div>
  )
}

export default Feedback
