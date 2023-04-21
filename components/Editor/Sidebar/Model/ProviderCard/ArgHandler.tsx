import Input from 'components/Input'
import { ModelTemplateArg } from 'state/model'
import { parseInput } from 'utils/parseInput'

export interface Props {
  argTemplate: ModelTemplateArg
  arg: string
  isSelected?: boolean
  updateModelConfigArg: (value: string | number | undefined) => void
  selectModel?: () => void
  value?: string | number | undefined
}

function ArgHandler({
  isSelected,
  arg,
  argTemplate,
  updateModelConfigArg,
  selectModel,
  value,
}: Props) {
  return (
    <Input
      value={value?.toString() || ''}
      type={argTemplate.type === 'number' ? 'number' : 'text'}
      onChange={v => updateModelConfigArg(parseInput(argTemplate, v))}
      isDisabled={!isSelected}
      max={argTemplate.max}
      onClick={selectModel}
      min={argTemplate.min}
      step={argTemplate.step}
      placeholder={argTemplate.value?.toString() || argTemplate.placeholder}
      label={argTemplate.label || arg}
    />
  )
}

export default ArgHandler
