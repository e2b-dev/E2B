import SpinnerIcon from 'components/Spinner'
import Text from 'components/Text'
import Button from 'components/Button'
import {
  CreationState,
} from 'utils/newProjectState'
import { TemplateID, templates } from 'state/template'
import TemplateButton from './TemplateButton'
import { useState } from 'react'

export interface Props {
  state: CreationState
  onBack: () => void
  onCreate: (templateID: TemplateID) => void
}

function NewProjectTemplateForm({
  state,
  onBack,
  onCreate,
}: Props) {
  const [selectedTemplateID, setSelectedTemplateID] = useState<TemplateID>(TemplateID.NodeJSExpress)

  return (
    <div className="
      space-y-6
      rounded
      border
      p-6
      bg-white
      ">
      <div className="space-y-1">
        <Text
          size={Text.size.S3}
          text="Select template"
        />
        <div className="
        sm:grid-cols-2
        grid
        gap-2
      ">
          {Object.values(TemplateID).map(t =>
            <TemplateButton
              key={t}
              onClick={() => setSelectedTemplateID(t)}
              template={templates[t]}
              isSelected={t === selectedTemplateID}
            />
          )}
          <div className="
          justify-center
          items-center
          border-dashed
          rounded
          border-2
          border-slate-200
          py-4
          flex
          ">
            <Text
              text="More coming soon"
            />
          </div>
        </div>
      </div>
      <div className="
        flex
        justify-between
      ">
        <Button
          isDisabled={state === CreationState.CreatingProject}
          text="Back"
          onClick={onBack}
        />
        <Button
          isDisabled={state === CreationState.CreatingProject}
          icon={state === CreationState.CreatingProject ? <SpinnerIcon /> : null}
          variant={Button.variant.Full}
          text={state === CreationState.CreatingProject ? 'Creating...' : 'Create'}
          onClick={() => onCreate(selectedTemplateID)}
        />
      </div>
    </div>
  )
}

export default NewProjectTemplateForm