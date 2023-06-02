import { useState } from 'react'

import InstructionsEditor from 'components/Editor/Template/NodeJSExpressTemplate/InstructionsEditor'

function AgentInstructions() {
  const [content, setContent] = useState('')
  return (
    <div className="flex-1 flex flex-col items-start justify-start space-y-2">
      <h3 className="text-white font-bold">What do you want the AI developer to build?</h3>
      <div className="relative bg-gray-950 flex flex-col p-2 w-full flex-1 overflow-auto border border-gray-700 rounded-md">
        <InstructionsEditor
          className='absolute inset-0 bg-gray-950 p-4 text-gray-100'
          placeholder="Create a website using Nextjs"
          content={content}
          onChange={setContent}
        />
      </div>
    </div>
  )
}

export default AgentInstructions
