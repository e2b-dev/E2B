import {
  useState,
} from 'react'
import {
  Plus,
} from 'lucide-react'
import AgentChallengeTagModal, { Severity } from 'components/AgentChallengeTagModal'

export interface Props {
  newTagName: string
  onNewTagNameChange: (e: any) => void
  onSeveritySelect: (s: Severity) => void
}

function AgentChallengeTagButton({
  newTagName,
  onNewTagNameChange,
  onSeveritySelect,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  function handleButtonClick() {
    setIsModalOpen(val => !val)
  }

  function handleModalClickOutside() {
    setIsModalOpen(false)
  }

  return (
    <div>
      <button
        className="flex items-center justify-center text-xs shrink-0 text-gray-400 bg-[#1F2437] hover:bg-[#272D44] h-6 w-6 rounded-md"
        onClick={handleButtonClick}
      >
        <Plus size={14} />
      </button>

      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-transparent z-40" />
          <AgentChallengeTagModal
            value={newTagName}
            onChange={onNewTagNameChange}
            onClickOutside={handleModalClickOutside}
            onSeveritySelect={onSeveritySelect}
          />
        </>
      )}
    </div>
  )
}

export default AgentChallengeTagButton