import {
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import clsx from 'clsx'

import OpenAIKeyInput from 'components/OpenAIKeyInput'

export interface Props {
  selectedOpenAIKeyType: string

  onSelectedOpenAIKeyTypeChange: (type: string) => void
  userOpenAIKey?: string
  onUserOpenAIKeyChange: (e: any) => void

  openAIModels: { displayName: string, value: string }[]
  selectedOpenAIModel: { displayName: string, value: string }
  onOpenAIModelChange: (value: string) => void

  onNext: () => void
  onBack: () => void
}

const baseClasses = 'text-xs font-semibold py-1 px-2 rounded-md transition-all cursor-pointer'
const unselectedClasses = 'text-gray-500 hover:bg-indigo-400/10 hover:text-indigo-400  border border-transparent hover:border-indigo-400/20'
const selectedClasses = 'bg-indigo-400/10 text-indigo-400  border border-indigo-400/20'

function ChooseOpenAIKey({
  selectedOpenAIKeyType,

  onSelectedOpenAIKeyTypeChange,
  userOpenAIKey,
  onUserOpenAIKeyChange,

  openAIModels,
  selectedOpenAIModel,
  onOpenAIModelChange,

  onNext,
  onBack,
}: Props) {
  const posthog = usePostHog()

  function handleContinue() {
    if (selectedOpenAIKeyType === 'user' && !userOpenAIKey) {
      return
    }
    posthog?.capture('selected OpenAI key', {
      selectedOpenAIKeyType,
      selectedOpenAIModel,
    })
    onNext()
  }

  return (
    <div className="flex-1 flex flex-col items-start justify-start space-y-2">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Select OpenAI API Key
      </h2>
      <p className="mt-2 mb-6 text-lg leading-8 text-gray-400">
        Pass your own OpenAI key or use the e2b key.
      </p>

      <div className="flex-1 w-full flex flex-col space-y-4 items-center justify-start">
        <div className="mb-2 flex items-center justify-center space-x-2">
          <div
            className={clsx(
              baseClasses,
              selectedOpenAIKeyType === 'e2b' ? selectedClasses : unselectedClasses,
            )}
            onClick={() => onSelectedOpenAIKeyTypeChange('e2b')}
          >
            Use e2b&apos;s OpenAI API Key
          </div>
          <div
            className={clsx(
              baseClasses,
              selectedOpenAIKeyType === 'user' ? selectedClasses : unselectedClasses,
            )}
            onClick={() => onSelectedOpenAIKeyTypeChange('user')}
          >
            Use my own OpenAI API key
          </div>
        </div>

        {selectedOpenAIKeyType === 'e2b' && (
          <ul className="list-disc p-4 border border-indigo-400/40 rounded-md text-sm">
            <li className="ml-4">Use the e2b key to get started quickly and not get charged for OpenAI API usage</li>
            <li className="ml-4">We can&apos;t guarantee that e2b will not get blocked by OpenAI API rate limits</li>
            <li className="ml-4"><b>All costs running the smol developer will be billed to e2b</b></li>
          </ul>
        )}
        {selectedOpenAIKeyType === 'user' && (
          <div className="flex flex-col space-y-2">
            <ul className="list-disc p-4 border border-indigo-400/40 rounded-md text-sm">
              <li className="ml-4">Use your own OpenAI API key</li>
              <li className="ml-4">Using your own key might help when e2b is hitting the OpenAI&apos;s API rate limits</li>
              <li className="ml-4"><b>All costs running the smol developer will be billed to your OpenAI account</b></li>
            </ul>
            <OpenAIKeyInput
              openAIKey={userOpenAIKey}
              onOpenAIKeyChange={onUserOpenAIKeyChange}
              models={openAIModels}
              selectedModel={selectedOpenAIModel}
              onModelChange={onOpenAIModelChange}
            />
          </div>
        )}
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

export default ChooseOpenAIKey