import React from 'react'

import Input from 'components/Input'
import { ModelConfigTemplate } from 'state/model'
import { SelectedModel } from 'state/store'
import { parseInput } from 'utils/parseInput'
import Text from 'components/Text'
import { CheckSquare, Square } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  isSelected?: boolean
  updateSelectedModel: (config: Omit<SelectedModel, 'name' | 'provider'>) => void
  modelTemplate: ModelConfigTemplate
  selectedModel?: SelectedModel
}

function ModelSection({
  isSelected,
  updateSelectedModel,
  modelTemplate,
  selectedModel,
}: Props) {
  function selectModel() {
    updateSelectedModel({
      args: {
        ...selectedModel?.args,
      }
    })
  }

  const editableArgs = Object
    .entries(modelTemplate.args || {})
    .filter(([, value]) => value.editable)

  return (
    <div className="
        flex
        py-1
        items-stretch
        ">
      <div className="
          flex
          flex-1
          items-stretch
          flex-col
          space-y-2
          ">
        <div className="
            items-center
            justify-between
            flex
            font-medium
          ">
          <Text
            text={modelTemplate.name}
          />
          <div
            onClick={selectModel}
            className={clsx(`
            rounded
            items-center
            cursor-pointer
            transition-all
            `,
              {
                'text-slate-200 hover:text-slate-400': !isSelected,
                'text-slate-600': isSelected,
              }
            )}
          >
            {isSelected
              ? <CheckSquare size="18px" />
              : <Square size="18px" />
            }
          </div>
        </div>
        <div className="
              flex
              flex-col
              space-y-2
            "
        >
          {isSelected && editableArgs.map(([key, value]) =>
            <Input
              value={selectedModel?.args[key]?.toString() || ''}
              type={value.type === 'number' ? 'number' : 'text'}
              onChange={v => updateSelectedModel({
                args: {
                  ...selectedModel?.args,
                  [key]: parseInput(value, v),
                }
              })}
              key={key}
              isDisabled={!isSelected}
              max={value.max}
              min={value.min}
              step={value.step}
              placeholder={value.value?.toString()}
              label={value.label || key}
            />
          )}
        </div>
      </div>
    </div >
  )
}

export default ModelSection
