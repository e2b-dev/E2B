import { ArrowLeft, ArrowRight, Github, KeySquare, Pencil } from 'lucide-react'

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
    <div className="agent-step-root">
      {isDeploying && (
        <div className="flex flex-col items-center py-12 gap-y-4">
          <SpinnerIcon className="w-8 h-8" />
          <span className="">Deploying...</span>
        </div>
      )}
      {!isDeploying && error && (
        <AlertError title="Deploy failed" infoItems={[error]} />
      )}
      {!isDeploying && (
        <>
          <h2 className="agent-step-title">Confirm & Deploy</h2>
          <p className="agent-step-subtitle">
            Make sure everything is to your liking and then deploy the agent.
          </p>

          <div className="agent-step-content">
            {/* Selected repo */}
            <div className="agent-step-overview-block">
              <span className="agent-step-overview-title">
                Repository
                <button
                  type="button"
                  className="agent-step-overview-edit"
                  title="Change repository"
                  onClick={onChangeRepo}
                >
                  <Pencil className="agent-step-overview-edit-icon" />
                </button>
              </span>
              <span className="agent-step-overview-value">
                <Github className="agent-step-overview-icon" />
                {selectedRepo?.fullName ?? 'Strajk/fixme'}
              </span>
            </div>

            {/* OpenAI Key */}
            <div className="agent-step-overview-block">
              <span className="agent-step-overview-title">
                OpenAI API Key
                <button
                  type="button"
                  className="agent-step-overview-edit"
                  title="Change OpenAI API key"
                  onClick={onBack}
                >
                  <Pencil className="agent-step-overview-edit-icon" />
                </button>
              </span>
              <span className="agent-step-overview-value">
                <KeySquare className="agent-step-overview-icon" />
                {selectedOpenAIKeyType === 'user' &&
                  'Use your own OpenAI API key'}
                {selectedOpenAIKeyType === 'e2b' && "Use e2b's OpenAI API key"}
              </span>
            </div>

            {/* Instructions */}
            <div className="agent-step-overview-block">
              <span className="agent-step-overview-title">
                Instructions
                <button
                  type="button"
                  className="agent-step-overview-edit"
                  onClick={onChangeTemplate}
                  title="Change instructions"
                >
                  <Pencil className="agent-step-overview-edit-icon" />
                </button>
              </span>
              <div className="agent-editor">
                <InstructionsEditor
                  className="agent-editor-textarea"
                  content={instructions}
                  onChange={onInstructionsChange}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="agent-step-footer">
            <button className="agent-step-footer-btn-back" onClick={onBack}>
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <button
              className="agent-step-footer-btn-next agent-step-footer-btn-next_final group"
              onClick={onDeploy}
            >
              <span>
                Deploy on <b>e2b</b>
              </span>
              <ArrowRight
                className="group-hover:translate-x-0.5 transition-all"
                size={14}
              />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default DeployAgent
