import SpinnerIcon from 'components/Spinner'
import Text from 'components/Text'
import Button from 'components/Button'
import {
  CreationState,
} from 'utils/newProjectState'

export interface Props {
  state: CreationState
  onBack: (e: any) => void
  onCreate: (e: any) => void
}

function NewProjectTemplateForm({
  state,
  onBack,
  onCreate,
}: Props) {
  return (
    <div className="
      space-y-6
      rounded
      border
      p-8
      flex
      flex-col
      bg-white
    ">
      <div className="
        flex
        flex-col
        items-start
        space-y-1
      ">
        <Text
          size={Text.size.S3}
          text="Select template"
        />
        <div className="
          flex
          gap-2
        ">
          <div className="
            px-4
            py-2
            bg-transparent
            cursor-pointer
            border
            border-green-800
            rounded
          ">
            <Text
              className="font-medium"
              text="REST API Server"
            />
          </div>

          <Text
            text="More coming soon"
          />
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
          onClick={onCreate}
        />
      </div>
    </div>
  )
}

export default NewProjectTemplateForm