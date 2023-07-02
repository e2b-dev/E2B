import {
  useCallback,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

import smolTemplates from 'utils/smolTemplates'
import InstructionsEditor, { InstructionsEditorRef } from 'components/InstructionsEditor'
import InstructionsTemplateButton from 'components/InstructionsTemplateButton'
import AlertError from 'components/AlertError'
import { usePostHog } from 'posthog-js/react'

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
  const posthog = usePostHog()

  function handleContinue() {
    setError(undefined)
    posthog?.capture('confirmed instructions', {
      instructions: value,
    })
    if (!value) {
      setError({
        title: 'No instructions provided',
        infoItems: [
          'Please provide instructions for the AI agent',
        ],
      })
      return
    }
    onNext()
  }

  const onFocus = useCallback(() => {
    posthog?.capture('focused instructions editor')
  }, [posthog])

  function handleTemplateClick(template: string) {
    editorRef.current?.setContent(template)
    onTemplateSelect(template)
    posthog?.capture('selected instructions template', {
      template: template,
    })
  }

  return (
    <div className="flex-1 flex flex-col items-start justify-start space-y-2">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Deploy <a className="text-indigo-400 hover:text-indigo-500 transition-all" href="https://github.com/smol-ai/developer" target="_blank" rel="noreferrer noopener">Smol Developer</a>
      </h2>
      <p className="mt-2 mb-6 text-lg leading-8 text-gray-400">
        What do you want the AI agent to build?
      </p>
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
          onFocus={onFocus}
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
          className="px-2 py-1 flex group items-center space-x-1 font-medium rounded-md border border-indigo-400/30 bg-indigo-400/10 text-indigo-400 hover:bg-transparent hover:border-indigo-400 transition-all"
          onClick={handleContinue}
        >
          <span className="text-sm">Continue</span>
          <ArrowRight className="group-hover:translate-x-0.5 transition-all" size={14} />
        </button>
      </div>
    </div>
  )
}

export default AgentInstructions
