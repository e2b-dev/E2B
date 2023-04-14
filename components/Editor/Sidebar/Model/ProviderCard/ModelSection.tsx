import React, { useState } from 'react'

import { ModelConfigTemplate } from 'state/model'
import { SelectedModel } from 'state/store'
import Text from 'components/Text'
import { CheckSquare, ChevronDown, Square } from 'lucide-react'
import clsx from 'clsx'
import ArgHandler from './ArgHandler'

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
  const [isDefaultArgsOpen, setIsDefaultArgsOpen] = useState(false)

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

  const requiredParams = editableArgs.filter(a => a[1].value === undefined)
  const defaultedArgs = editableArgs.filter(a => a[1].value !== undefined)

  return (
    <div className="
        flex
        items-stretch
        ">
      <div className="
          flex
          flex-1
          items-stretch
          flex-col
          py-1
          space-y-1
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
          {requiredParams.map(([arg, template]) =>
            <ArgHandler
              selectModel={selectModel}
              updateSelectedModel={updateSelectedModel}
              arg={arg}
              key={arg}
              argTemplate={template}
              isSelected={isSelected}
              selectedModel={selectedModel}
            />
          )}
          {defaultedArgs.length > 0 &&
            <div className="
              flex
              space-y-1
              flex-col
            ">
              <div className="flex">
                <div
                  onClick={() => setIsDefaultArgsOpen(a => !a)}
                  className="
                  flex
                  items-center
                  space-x-1
                  cursor-pointer
                  text-slate-400
                  hover:text-slate-600
                  transition-colors
                  "
                >
                  <ChevronDown
                    size="16px"
                    className={clsx(`
                  transition-transform
                `, {
                      '-rotate-90': !isDefaultArgsOpen,
                    })}
                  />
                  <Text
                    className="select-none"
                    size={Text.size.S3}
                    text="Configure"
                  />
                </div>
              </div>
              {isDefaultArgsOpen &&
                <div>
                  {defaultedArgs.map(([arg, template]) =>
                    <ArgHandler
                      selectModel={selectModel}
                      updateSelectedModel={updateSelectedModel}
                      arg={arg}
                      key={arg}
                      argTemplate={template}
                      isSelected={isSelected}
                      selectedModel={selectedModel}
                    />
                  )}
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div >
  )
}

export default ModelSection
