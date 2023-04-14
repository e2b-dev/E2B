import { Check, Wrench } from 'lucide-react'
import React from 'react'
import clsx from 'clsx'

import Input from 'components/Input'
import Text from 'components/Text'
import { ModelConfigTemplate } from 'state/model'
import { SelectedModel } from 'state/store'
import { parseInput } from 'utils/parseInput'

interface Props {
  isSelected?: boolean
  updateSelectedModel: (config: Omit<SelectedModel, 'name' | 'provider'>) => void
  modelTemplate: ModelConfigTemplate
  selectedModel?: SelectedModel
}

function ModelCard({
  isSelected,
  updateSelectedModel,
  modelTemplate,
  selectedModel,
}: Props) {
  return (
    <div className={clsx(
      `

      `
    )}>
    </div>
  )
  return (
    <div
      className={clsx(
        // {
        //   'border-green-800 text-slate-600 shadow-sm': isSelected,
        //   'bg-white border-slate-300 text-slate-400': !isSelected,
        // },
        `
        relative
        flex
        min-h-[50px]
        cursor-pointer
        rounded
        p-2
        border
        hover:text-slate-600
        hover:border-green-800
        bg-green-800
      `)}
      onClick={() => updateSelectedModel({
        args: {
          ...selectedModel?.args,
        }
      })}
    >
      <div className="
        flex
        w-full
        items-center
        justify-between
      ">
        <div className="
          flex
          items-start
          flex-col
          space-y-2
          ">
          <div className="
            text-sm
            items-center
            font-medium
          ">
            {modelTemplate.name}
          </div>
          {Object
            .entries(modelTemplate.args || {})
            .filter(([, value]) => value.editable).length > 0 &&
            <>
              <Text
                text="Configuration"
                className="font-medium pt-3"
                icon={<Wrench size="16px" />}
                size={Text.size.S3}
              />
              <div className="
              flex
              flex-col
              space-y-2
            "
              >
                {Object.entries(modelTemplate.args || {})
                  .filter(([, value]) => value.editable)
                  .map(([key, value]) =>
                    <div
                      key={key}
                    >
                      <Input
                        value={selectedModel?.args[key]?.toString() || ''}
                        type={value.type === 'number' ? 'number' : 'text'}
                        onChange={v => updateSelectedModel({
                          args: {
                            ...selectedModel?.args,
                            [key]: parseInput(value, v),
                          }
                        })}
                        max={value.max}
                        min={value.min}
                        step={value.step}
                        placeholder={value.value?.toString()}
                        label={value.label || key}
                      />
                    </div>
                  )}
              </div>
            </>
          }
        </div>
        {isSelected && (
          <div className="shrink-0 text-green-800">
            <Check size="20px" />
          </div>
        )}
      </div>
    </div >
  )
}

export default ModelCard
