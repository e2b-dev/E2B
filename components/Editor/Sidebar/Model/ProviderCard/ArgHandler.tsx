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
  selectModel?: () => void
}

function ArgHandler({
  isSelected,
  arg,
  updateSelectedModel,
  argTemplate,
  selectedModel,
  selectModel,
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
      onClick={selectModel}
      min={argTemplate.min}
      step={argTemplate.step}
      placeholder={argTemplate.value?.toString() || argTemplate.placeholder}
      label={argTemplate.label || arg}
    />
  )
}

export default ArgHandler
