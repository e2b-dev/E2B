import {
  ArrowLeft, Github, ScrollText
} from 'lucide-react'

import InstructionsEditor from 'components/InstructionsEditor'
import SpinnerIcon from 'components/Spinner'
import { RepoSetup } from 'utils/repoSetup'
import AlertError from './AlertError'

export interface Props {
  selectedRepo: RepoSetup
  instructions: string
  onInstructionsChange: (value: string) => void
  onChangeTemplate: (e: any) => void
  onChangeRepo: (e: any) => void
  onBack: (e: any) => void
  onDeploy: (e: any) => void
  isDeploying?: boolean
  error?: string
  selectedOpenAIKeyType: 'e2b' | 'user'
}

function DeployAgent(props: Props) {
  const { selectedRepo,
    instructions,
    onInstructionsChange,
    onChangeTemplate,
    onChangeRepo,
    onBack,
    onDeploy,
    isDeploying,
    selectedOpenAIKeyType,
    error } = props



  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 w-full flex flex-col space-y-4 items-center justify-start">
        {isDeploying && (
          <div className="flex flex-col items-center gap-2 w-full">
            <SpinnerIcon className="text-gray-400" />
            <span className="text-gray-400 text-sm">Deploying...</span>
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
            <div className="w-full flex items-center justify-between">
              <span className="text-sm">
                OpenAI API Key
              </span>
              <span className="text-sm text-indigo-400">
                {selectedOpenAIKeyType === 'user' && 'Use your own OpenAI API key'}
                {selectedOpenAIKeyType === 'e2b' && 'Use e2b\'s OpenAI API key'}
              </span>
            </div>
            <hr className="w-full h-px bg-gray-700 my-8 border-0" />

            {/* Selected repo */}
            <div className=" w-full flex flex-col justify-start">
              <div className="w-full flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  <Github className="" size={16} />
                  <span className="">
                    Repository
                  </span>
                </div>

                <button
                  type="button"
                  className="flex items-center rounded-md bg-indigo-400/10 active:bg-indigo-400/20 px-2 py-1 text-xs font-medium text-indigo-400 border border-indigo-400/30 hover:border-indigo-400 cursor-pointer transition-all whitespace-nowrap"
                  onClick={onChangeRepo}
                >
                  Change Repository
                </button>
              </div>

              <span className="text-gray-400 text-sm">
                {selectedRepo.fullName}
              </span>
            </div>

            <hr className="w-full h-px bg-gray-700 my-8 border-0" />

            {/* Instructions */}
            <div className="flex-1 w-full flex flex-col space-y-4 items-center justify-start">
              <div className="w-full flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  <ScrollText size={16} />
                  <span className="">
                    Instructions
                  </span>
                </div>
                <button
                  type="button"
                  className="flex items-center rounded-md bg-indigo-400/10 active:bg-indigo-400/20 px-2 py-1 text-xs font-medium text-indigo-400 border border-indigo-400/30 hover:border-indigo-400 cursor-pointer transition-all whitespace-nowrap"
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
                className="px-2 py-1 flex group items-center space-x-1 font-medium rounded-md border border-indigo-400/30 bg-indigo-400/10 text-indigo-400 hover:bg-transparent hover:border-indigo-400 transition-all text-sm"
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
