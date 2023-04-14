import Input from 'components/Input'
import { ModelArgTemplate } from 'state/model'
import { SelectedModel } from 'state/store'
import { parseInput } from 'utils/parseInput'

export interface Props {
  updateSelectedModel: (config: Omit<SelectedModel, 'name' | 'provider'>) => void
  argTemplate: ModelArgTemplate
  selectedModel?: SelectedModel
  arg: string
  isSelected?: boolean
}

function ArgHandler({
  isSelected,
  arg,
  updateSelectedModel,
  argTemplate,
  selectedModel,
}: Props) {
  return (
    <Input
      value={selectedModel?.args[arg]?.toString() || ''}
      type={argTemplate.type === 'number' ? 'number' : 'text'}
      onChange={v => updateSelectedModel({
        args: {
          ...selectedModel?.args,
          [arg]: parseInput(argTemplate, v),
        }
      })}
      isDisabled={!isSelected}
      max={argTemplate.max}
      min={argTemplate.min}
      step={argTemplate.step}
      placeholder={argTemplate.value?.toString()}
      label={argTemplate.label || arg}
    />
  )
}

export default ArgHandler
