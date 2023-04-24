import Text from 'components/Text'
import Input from 'components/Input'
import Button from 'components/Button'

export interface Props {
  value: string
  onChange: (v: string) => void
  error?: string
  isNextDisabled?: boolean
  onNext: (e: any) => void
}

function NewProjectIDForm({
  value,
  onChange,
  error,
  isNextDisabled,
  onNext,
}: Props) {
  return (
    <div className="
      space-y-6
      rounded
      border
      p-6
      flex
      flex-col
      bg-white
    ">
      <div className="flex flex-col flex-1 space-y-1">
        <Input
          title="Must be a combination of letters, numbers and dashes"
          pattern="[^a-zA-Z0-9\-]"
          label="Project name"
          placeholder="Project name"
          value={value}
          onChange={onChange}
          required
          autofocus
        />
        <Text
          text="Combination of letters, numbers and dashes"
          size={Text.size.S3}
          className="text-slate-400"
        />
      </div>
      <div className="flex justify-center flex-col space-y-4">
        <Button
          isDisabled={isNextDisabled}
          onClick={onNext}
          text="Next"
          variant={Button.variant.Full}
          className="self-center whitespace-nowrap"
        />
      </div>
    </div>
  )
}

export default NewProjectIDForm