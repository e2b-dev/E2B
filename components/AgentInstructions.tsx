import {
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
} from 'lucide-react'

import smolTemplates from 'utils/smolTemplates'
import InstructionsEditor, { InstructionsEditorRef } from 'components/Editor/Template/NodeJSExpressTemplate/InstructionsEditor'
import InstructionsTemplateButton from 'components/InstructionsTemplateButton'
import AlertError from 'components/AlertError'

export interface Props {
  value: string
  onChange: (value: string) => void
  onTemplateSelect: (template: string) => void
  onBack: () => void
  onNext: () => void
}

function AgentInstructions({
  value,
  onChange,
  onTemplateSelect,
  onBack,
  onNext,
}: Props) {
  const [error, setError] = useState<{ title: string, infoItems: string[] }>()
  const editorRef = useRef<InstructionsEditorRef>(null)

  function handleContinue() {
    setError(undefined)
    if (!value) {
      setError({
        title: 'No instructions provided',
        infoItems: [
          'Please provide instructions for the AI developer to follow',
        ],
      })
      return
    }
    onNext()
  }

  function handleTemplateClick(template: string) {
    editorRef.current?.setContent(template)
    onTemplateSelect(template)
  }

  return (
    <div className="flex-1 flex flex-col items-start justify-start space-y-2">
      <h3 className="text-white font-bold">What do you want the AI developer to build?</h3>
      {error && (
        <AlertError
          title={error.title}
          infoItems={error.infoItems}
        />
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.keys(smolTemplates).map((key) => (
          <InstructionsTemplateButton
            key={key}
            text={smolTemplates[key].title}
            onClick={() => handleTemplateClick(smolTemplates[key].content)}
          />
        ))}
      </div>
      <div className="relative bg-gray-950 flex flex-col p-2 w-full flex-1 overflow-auto border border-gray-700 rounded-md">
        <InstructionsEditor
          ref={editorRef}
          className="absolute inset-0 bg-gray-950 p-4 text-gray-100"
          placeholder="Create a website using Nextjs..."
          content={value}
          onChange={onChange}
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
          className="px-2 py-1 font-medium rounded-md text-sm border border-indigo-400/30 bg-indigo-400/10 text-indigo-400 hover:bg-transparent hover:border-indigo-400 transition-all"
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default AgentInstructions
