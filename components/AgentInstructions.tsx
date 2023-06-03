import { useState } from 'react'
import {
  ArrowLeft,
} from 'lucide-react'

import InstructionsEditor from 'components/Editor/Template/NodeJSExpressTemplate/InstructionsEditor'

export interface Props {
  onBack: () => void
  onNext: (instructions: string) => void
}

function AgentInstructions({
  onBack,
  onNext,
}: Props) {
  const [content, setContent] = useState('')
  return (
    <div className="flex-1 flex flex-col items-start justify-start space-y-2">
      <h3 className="text-white font-bold">What do you want the AI developer to build?</h3>
      <div className="relative bg-gray-950 flex flex-col p-2 w-full flex-1 overflow-auto border border-gray-700 rounded-md">
        <InstructionsEditor
          className="absolute inset-0 bg-gray-950 p-4 text-gray-100"
          placeholder="Create a website using Nextjs..."
          content={content}
          onChange={setContent}
        />
      </div>
      <div className="w-full flex items-center justify-between">
        <button
          className="flex items-center justify-start space-x-1 text-gray-400 hover:text-gray-100 transition-all"
          onClick={onBack}
        >
          <ArrowLeft size={14} />
          <span className="text-sm">Back</span>
        </button>
        <button
          className="px-2 py-1 font-medium rounded-md text-sm border border-transparent bg-indigo-600/30 text-indigo-500 hover:bg-transparent hover:border-indigo-600 transition-all"
          onClick={() => onNext(content)}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default AgentInstructions
