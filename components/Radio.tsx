import { RadioGroup } from '@headlessui/react'
import { Check } from 'lucide-react'

export type Item = string

export interface Props {
  selected: Item
  select: (item: Item) => void
  items: Item[]
  getLabel: (item: Item) => string | undefined
}

function Radio<T>({ selected, items, select, getLabel }: Props) {
  return (
    <div className="mx-auto w-full">
      <RadioGroup value={selected} onChange={select}>
        <RadioGroup.Label className="sr-only">Server size</RadioGroup.Label>
        <div className="space-y-2">
          {items.map((item) => (
            <RadioGroup.Option
              key={item}
              value={item}
              className={({ active, checked }) =>
                `
                  ${checked ? 'border-green-800' : 'bg-white border-slate-300'
                }
                    relative flex cursor-pointer rounded-lg px-2 py-1 border hover:border-green-800 transition-all`
              }
            >
              {({ active, checked }) => (
                <>
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm items-center transition-all">
                        <RadioGroup.Label
                          as="p"
                          className={`font-medium  ${checked ? 'text-slate-600' : 'text-slate-500'
                            }`}
                        >
                          {getLabel(item)}
                        </RadioGroup.Label>
                        <RadioGroup.Description
                          as="span"
                          className={`inline text-xs ${checked ? 'text-slate-500' : 'text-slate-400'
                            }`}
                        >
                          <span className="font-mono">
                            {item}
                          </span>
                        </RadioGroup.Description>
                      </div>
                    </div>
                    {checked && (
                      <div className="shrink-0 text-green-800">
                        <Check size="20px" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </RadioGroup.Option>
          ))}
        </div>
      </RadioGroup>
    </div>
  )
}

export default Radio
