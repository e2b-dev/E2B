import {
  Github,
  ArrowLeft,
  ScrollText,
} from 'lucide-react'

import InstructionsEditor from 'components/InstructionsEditor'
import { RepoSetup } from 'utils/repoSetup'
import SpinnerIcon from 'components/Spinner'
import AlertError from './AlertError'

export interface Props {
  selectedRepo: RepoSetup;
  instructions: string
  onInstructionsChange: (value: string) => void
  onChangeTemplate: (e: any) => void
  onChangeRepo: (e: any) => void
  onBack: (e: any) => void
  onDeploy: (e: any) => void
  isDeploying?: boolean
  error?: string
  selectedOpenAIKeyType: string // 'e2b' or 'user'
}

function DeployAgent({
  selectedRepo,
  instructions,
  onInstructionsChange,
  onChangeTemplate,
  onChangeRepo,
  onBack,
  onDeploy,
  isDeploying,
  selectedOpenAIKeyType,
  error,
}: Props) {
  return (
    <div className="flex-1 flex flex-col items-start justify-start space-y-2">
      <div className="flex-1 w-full flex flex-col items-start justify-start space-y-8">

        {isDeploying && (
          <div className="flex-1 w-full flex space-x-2 items-center justify-center">
            <SpinnerIcon className="text-gray-300" />
            <span className="text-gray-300">Deploying...</span>
          </div>
        )}
        {!isDeploying && error && (
          <AlertError
            title="Deploy failed"
            infoItems={[error]}
          />
        )}
        {!isDeploying && (
          <>
            {/* OpenAI Key */}
            <div className="w-full flex flex-col space-y-2 items-start justify-start">
              <span className="text-sm text-gray-300 font-medium">
                OpenAI API Key
              </span>
              <span className="text-sm font-medium text-gray-100">
                {selectedOpenAIKeyType === 'user' && 'Use your own OpenAI API key'}
                {selectedOpenAIKeyType === 'e2b' && 'Use e2b\'s OpenAI API key'}
              </span>
            </div>

            <hr className="w-full border-gray-700 rounded" />

            {/* Selected repo */}
            <div className="w-full flex flex-col space-y-2 items-start justify-start">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Github className="text-gray-300" size={16} />
                  <span className="text-sm text-gray-300 font-medium">
                    Repository
                  </span>
                </div>

                <button
                  type="button"
                  className="rounded w-[136px] bg-white/10 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-white/20"
                  onClick={onChangeRepo}
                >
                  Change Repository
                </button>
              </div>

              <span className="text-sm font-medium text-gray-100">
                {selectedRepo.fullName}
              </span>
            </div>

            <hr className="w-full border-gray-700 rounded" />

            {/* Instructions */}
            <div className="flex-1 w-full flex flex-col space-y-2 items-start justify-start">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <ScrollText className="text-gray-300" size={16} />
                  <span className="text-sm text-gray-300 font-medium">
                    Instructions
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded w-[136px] bg-white/10 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-white/20"
                  onClick={onChangeTemplate}
                >
                  Use Template
                </button>
              </div>

              <div className="relative bg-gray-950 flex flex-col p-2 w-full flex-1 overflow-auto border border-gray-700 rounded-md">
                <InstructionsEditor
                  className="absolute inset-0 bg-gray-950 p-4 text-gray-100"
                  content={instructions}
                  onChange={onInstructionsChange}
                />
              </div>
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
                className="px-2 py-1 font-medium rounded-md text-sm border border-green-400/30 bg-green-400/10 text-green-400 hover:bg-transparent hover:border-green-400 transition-all"
                onClick={onDeploy}
              >
                Deploy on <b>e2b</b>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default DeployAgent
