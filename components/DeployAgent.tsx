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
    <div className="">
      <div className="">

        {isDeploying && (
          <div className="">
            <SpinnerIcon className="" />
            <span className="">Deploying...</span>
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
            <div className="">
              <span className="">
                OpenAI API Key
              </span>
              <span className="">
                {selectedOpenAIKeyType === 'user' && 'Use your own OpenAI API key'}
                {selectedOpenAIKeyType === 'e2b' && 'Use e2b\'s OpenAI API key'}
              </span>
            </div>

            <hr className="" />

            {/* Selected repo */}
            <div className="">
              <div className="">
                <div className="">
                  <Github className="" size={16} />
                  <span className="">
                    Repository
                  </span>
                </div>

                <button
                  type="button"
                  className=""
                  onClick={onChangeRepo}
                >
                  Change Repository
                </button>
              </div>

              <span className="">
                {selectedRepo.fullName}
              </span>
            </div>

            <hr className="" />

            {/* Instructions */}
            <div className="">
              <div className="">
                <div className="">
                  <ScrollText className="" size={16} />
                  <span className="">
                    Instructions
                  </span>
                </div>
                <button
                  type="button"
                  className=""
                  onClick={onChangeTemplate}
                >
                  Use Template
                </button>
              </div>

              <div className="">
                <InstructionsEditor
                  className=""
                  content={instructions}
                  onChange={onInstructionsChange}
                />
              </div>
            </div>
            <div className="">
              <button
                className=""
                onClick={onBack}
              >
                <ArrowLeft size={14} />
                <span className="">Back</span>
              </button>
              <button
                className=""
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
