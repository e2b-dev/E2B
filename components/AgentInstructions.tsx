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
    <div className="agent-step-root">
      <h2 className="agent-step-title">
        Agent Instructions
      </h2>
      <p className="agent-step-subtitle">
        What do you want the AI agent to build?
      </p>
      <div className="agent-step-content">
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
        <div className="agent-editor">
          <InstructionsEditor
            ref={editorRef}
            onFocus={onFocus}
            className="agent-editor-textarea"
            placeholder="Create a website using Nextjs..."
            content={value}
            onChange={onChange}
          />
        </div>
      </div>
      <div className="agent-step-footer mt-4">
        <button
          className="agent-step-footer-btn-back"
          onClick={onBack}
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <button
          className="agent-step-footer-btn-next group"
          onClick={handleContinue}
        >
          <span>Continue</span>
          <ArrowRight className="group-hover:translate-x-0.5 transition-all" size={14} />
        </button>
      </div>
    </div>
  )
}

export default AgentInstructions
